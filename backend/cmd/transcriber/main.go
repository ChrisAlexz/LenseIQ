// Command transcriber splits a video into chunks, transcribes each chunk
// concurrently via the Deepgram API, and writes a merged transcript.json
// (a JSON array of {start, end, text} segments) to stdout.
//
// Input (JSON, via stdin or a file path given as the first argument):
//
//	{
//	  "video_path": "/path/to/video.mp4",
//	  "chunks": [
//	    {"index": 0, "start": 0, "end": 65, "hard_start": 0, "hard_end": 60},
//	    {"index": 1, "start": 55, "end": 125, "hard_start": 60, "hard_end": 120}
//	  ]
//	}
//
// Requires DEEPGRAM_API_KEY in the environment.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// deepgramURL is a var (not const) so tests can point it at a mock server.
var deepgramURL = "https://api.deepgram.com/v1/listen?model=nova-2&language=en&utterances=true"

// Chunk describes one slice of the source video to transcribe.
//
// start/end are the (possibly overlap-extended) bounds passed to ffmpeg.
// hard_start/hard_end are the non-overlapping region this chunk "owns";
// segments whose midpoint falls outside [hard_start, hard_end] are dropped
// so overlapping chunks don't produce duplicate segments. If hard_end <=
// hard_start, no filtering is applied (the whole chunk is "owned").
type Chunk struct {
	Index     int     `json:"index"`
	Start     float64 `json:"start"`
	End       float64 `json:"end"`
	HardStart float64 `json:"hard_start"`
	HardEnd   float64 `json:"hard_end"`
}

// Input is the JSON payload read from stdin/args.
type Input struct {
	VideoPath string  `json:"video_path"`
	Chunks    []Chunk `json:"chunks"`
}

// Word is a single transcribed word with absolute (video-time) bounds.
type Word struct {
	Word  string  `json:"word"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

// Segment is one transcript entry. start/end/text keep the shape consumed by
// linguistic.keyword_detection; words carries Deepgram's real per-word
// timestamps so caption generation doesn't have to fake them.
type Segment struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
	Words []Word  `json:"words,omitempty"`
}

type dgWord struct {
	Word  string  `json:"word"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

type deepgramResponse struct {
	Results struct {
		Utterances []struct {
			Start      float64  `json:"start"`
			End        float64  `json:"end"`
			Transcript string   `json:"transcript"`
			Words      []dgWord `json:"words"`
		} `json:"utterances"`
	} `json:"results"`
}

type chunkResult struct {
	index    int
	segments []Segment
	err      error
}

func main() {
	apiKey := os.Getenv("DEEPGRAM_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "DEEPGRAM_API_KEY is not set")
		os.Exit(1)
	}

	input, err := readInput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to read input: %v\n", err)
		os.Exit(1)
	}
	if input.VideoPath == "" || len(input.Chunks) == 0 {
		fmt.Fprintln(os.Stderr, "input must include video_path and at least one chunk")
		os.Exit(1)
	}

	maxConcurrency := 8
	if v := os.Getenv("TRANSCRIBER_MAX_CONCURRENCY"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxConcurrency = n
		}
	}

	httpClient := &http.Client{Timeout: 120 * time.Second}

	results := make(chan chunkResult, len(input.Chunks))
	sem := make(chan struct{}, maxConcurrency)

	var wg sync.WaitGroup
	for _, chunk := range input.Chunks {
		wg.Add(1)
		go func(c Chunk) {
			defer wg.Done()

			sem <- struct{}{}
			defer func() { <-sem }()

			segments, err := processChunk(httpClient, apiKey, input.VideoPath, c)
			results <- chunkResult{index: c.Index, segments: segments, err: err}
		}(chunk)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var all []Segment
	failures := 0
	for r := range results {
		if r.err != nil {
			failures++
			fmt.Fprintf(os.Stderr, "chunk %d failed: %v\n", r.index, r.err)
			continue
		}
		all = append(all, r.segments...)
	}

	if failures == len(input.Chunks) {
		fmt.Fprintln(os.Stderr, "all chunks failed")
		os.Exit(1)
	}

	sort.Slice(all, func(i, j int) bool { return all[i].Start < all[j].Start })
	if all == nil {
		all = []Segment{}
	}

	out, err := json.MarshalIndent(all, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to marshal output: %v\n", err)
		os.Exit(1)
	}
	os.Stdout.Write(out)
	os.Stdout.Write([]byte("\n"))
}

func readInput() (Input, error) {
	var raw []byte
	var err error
	if len(os.Args) > 1 {
		raw, err = os.ReadFile(os.Args[1])
	} else {
		raw, err = io.ReadAll(os.Stdin)
	}
	if err != nil {
		return Input{}, err
	}

	var input Input
	if err := json.Unmarshal(raw, &input); err != nil {
		return Input{}, err
	}
	return input, nil
}

// processChunk extracts [c.Start, c.End) of videoPath as a 16kHz mono WAV,
// sends it to Deepgram, and returns the segments this chunk owns.
func processChunk(client *http.Client, apiKey, videoPath string, c Chunk) ([]Segment, error) {
	wav, err := extractAudioChunk(videoPath, c.Start, c.End)
	if err != nil {
		return nil, fmt.Errorf("ffmpeg extraction: %w", err)
	}

	resp, err := transcribeWithDeepgram(client, apiKey, wav)
	if err != nil {
		return nil, fmt.Errorf("deepgram request: %w", err)
	}

	filterByHardBounds := c.HardEnd > c.HardStart

	var segments []Segment
	for _, u := range resp.Results.Utterances {
		words := u.Words
		if len(words) == 0 {
			// Deepgram should include word-level timestamps alongside
			// utterances, but fall back to treating the whole utterance
			// as a single "word" if it doesn't.
			text := strings.TrimSpace(u.Transcript)
			if text == "" {
				continue
			}
			words = []dgWord{{Word: text, Start: u.Start, End: u.End}}
		}

		// Trim to just the words owned by this chunk (by hard bounds), so
		// an utterance straddling a chunk boundary contributes only its
		// portion to each chunk instead of being duplicated whole on both
		// sides. Word start times are monotonically non-decreasing, so the
		// "owned" words form a single contiguous run.
		var kept []dgWord
		for _, w := range words {
			absStart := c.Start + w.Start
			absEnd := c.Start + w.End
			if filterByHardBounds && (absStart < c.HardStart || absStart > c.HardEnd) {
				if len(kept) > 0 {
					segments = append(segments, buildSegment(kept))
					kept = nil
				}
				continue
			}
			kept = append(kept, dgWord{Word: w.Word, Start: absStart, End: absEnd})
		}
		if len(kept) > 0 {
			segments = append(segments, buildSegment(kept))
		}
	}
	return segments, nil
}

// buildSegment joins a contiguous run of (already chunk-offset) words into
// a single transcript segment, preserving the per-word timestamps.
func buildSegment(words []dgWord) Segment {
	texts := make([]string, 0, len(words))
	outWords := make([]Word, 0, len(words))
	for _, w := range words {
		t := strings.TrimSpace(w.Word)
		if t == "" {
			continue
		}
		texts = append(texts, t)
		outWords = append(outWords, Word{
			Word:  t,
			Start: round3(w.Start),
			End:   round3(w.End),
		})
	}
	return Segment{
		Start: round3(words[0].Start),
		End:   round3(words[len(words)-1].End),
		Text:  strings.Join(texts, " "),
		Words: outWords,
	}
}

// extractAudioChunk uses ffmpeg to pull [start, end) seconds of audio from
// videoPath as a 16kHz mono WAV, written to stdout and captured in memory.
func extractAudioChunk(videoPath string, start, end float64) ([]byte, error) {
	duration := end - start
	if duration <= 0 {
		return nil, fmt.Errorf("invalid chunk duration: start=%.3f end=%.3f", start, end)
	}

	cmd := exec.Command("ffmpeg",
		"-ss", strconv.FormatFloat(start, 'f', 3, 64), // before -i: fast keyframe seek
		"-i", videoPath,
		"-t", strconv.FormatFloat(duration, 'f', 3, 64),
		"-ac", "1",
		"-ar", "16000",
		"-vn",
		"-f", "wav",
		"-",
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("%v: %s", err, strings.TrimSpace(stderr.String()))
	}
	return stdout.Bytes(), nil
}

// transcribeWithDeepgram sends raw WAV bytes to Deepgram's pre-recorded
// transcription endpoint and returns the parsed response.
func transcribeWithDeepgram(client *http.Client, apiKey string, wav []byte) (*deepgramResponse, error) {
	req, err := http.NewRequest(http.MethodPost, deepgramURL, bytes.NewReader(wav))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Token "+apiKey)
	req.Header.Set("Content-Type", "audio/wav")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deepgram returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed deepgramResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("invalid deepgram response: %w", err)
	}
	return &parsed, nil
}

func round3(v float64) float64 {
	return math.Round(v*1000) / 1000
}
