package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// TestProcessChunkEndToEnd runs ffmpeg extraction against a real sample
// video and a mocked Deepgram endpoint, verifying that utterance times get
// offset by the chunk start and filtered to the chunk's hard bounds.
func TestProcessChunkEndToEnd(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not available")
	}

	video, err := filepath.Abs("../../../frontend/public/uiclips/goal.mp4")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(video); err != nil {
		t.Skipf("sample video not found: %v", err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Token test-key" {
			t.Errorf("unexpected Authorization header: %q", got)
		}
		if got := r.Header.Get("Content-Type"); got != "audio/wav" {
			t.Errorf("unexpected Content-Type header: %q", got)
		}

		body := map[string]any{
			"results": map[string]any{
				"utterances": []map[string]any{
					{"start": 0.5, "end": 1.5, "transcript": "goal!"},
					{"start": 5.0, "end": 5.9, "transcript": "outside chunk"},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(body)
	}))
	defer srv.Close()

	oldURL := deepgramURL
	deepgramURL = srv.URL
	defer func() { deepgramURL = oldURL }()

	client := srv.Client()

	// hard bounds [0, 4.682] should keep "goal!" (mid=1.0) but drop
	// "outside chunk" (mid=5.45).
	chunk := Chunk{Index: 0, Start: 0, End: 6.0, HardStart: 0, HardEnd: 4.682}

	segments, err := processChunk(client, "test-key", video, chunk)
	if err != nil {
		t.Fatalf("processChunk failed: %v", err)
	}

	if len(segments) != 1 {
		t.Fatalf("expected 1 segment within hard bounds, got %d: %+v", len(segments), segments)
	}
	if segments[0].Text != "goal!" {
		t.Errorf("unexpected text: %q", segments[0].Text)
	}
	if segments[0].Start != 0.5 || segments[0].End != 1.5 {
		t.Errorf("unexpected offset times: %+v", segments[0])
	}
}

// TestProcessChunkOffsetsByChunkStart checks that segment times are offset
// by the chunk's start time (not just chunk 0).
func TestProcessChunkOffsetsByChunkStart(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not available")
	}

	video, err := filepath.Abs("../../../frontend/public/uiclips/goal.mp4")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(video); err != nil {
		t.Skipf("sample video not found: %v", err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := map[string]any{
			"results": map[string]any{
				"utterances": []map[string]any{
					{"start": 0.2, "end": 0.8, "transcript": "second half"},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(body)
	}))
	defer srv.Close()

	oldURL := deepgramURL
	deepgramURL = srv.URL
	defer func() { deepgramURL = oldURL }()

	client := srv.Client()

	// chunk starting at 3s into the video; no hard-bound filtering.
	chunk := Chunk{Index: 1, Start: 3, End: 6.006}

	segments, err := processChunk(client, "test-key", video, chunk)
	if err != nil {
		t.Fatalf("processChunk failed: %v", err)
	}
	if len(segments) != 1 {
		t.Fatalf("expected 1 segment, got %d: %+v", len(segments), segments)
	}
	if segments[0].Start != 3.2 || segments[0].End != 3.8 {
		t.Errorf("expected times offset by chunk.Start=3, got %+v", segments[0])
	}
}

// TestProcessChunkTrimsUtteranceWordsToHardBounds reproduces the overlap bug:
// an utterance whose words straddle a chunk boundary should be trimmed to
// just the words this chunk owns, rather than included (or excluded) as a
// whole. This is what stops adjacent chunks from emitting duplicate,
// overlapping segments that send caption timing backwards.
func TestProcessChunkTrimsUtteranceWordsToHardBounds(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not available")
	}

	video, err := filepath.Abs("../../../frontend/public/uiclips/goal.mp4")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(video); err != nil {
		t.Skipf("sample video not found: %v", err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// One utterance spanning 3.0-5.0s (relative to this chunk's audio),
		// straddling this chunk's hard end at 4.0s (absolute, since
		// chunk.Start=0).
		body := map[string]any{
			"results": map[string]any{
				"utterances": []map[string]any{
					{
						"start": 3.0, "end": 5.0, "transcript": "what a huge save there",
						"words": []map[string]any{
							{"word": "what", "start": 3.0, "end": 3.2},
							{"word": "a", "start": 3.2, "end": 3.3},
							{"word": "huge", "start": 3.3, "end": 3.6},
							{"word": "save", "start": 4.1, "end": 4.4}, // crosses HardEnd=4.0
							{"word": "there", "start": 4.4, "end": 5.0},
						},
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(body)
	}))
	defer srv.Close()

	oldURL := deepgramURL
	deepgramURL = srv.URL
	defer func() { deepgramURL = oldURL }()

	client := srv.Client()

	chunk := Chunk{Index: 0, Start: 0, End: 6.0, HardStart: 0, HardEnd: 4.0}

	segments, err := processChunk(client, "test-key", video, chunk)
	if err != nil {
		t.Fatalf("processChunk failed: %v", err)
	}
	if len(segments) != 1 {
		t.Fatalf("expected 1 trimmed segment, got %d: %+v", len(segments), segments)
	}
	got := segments[0]
	if got.Text != "what a huge" {
		t.Errorf("expected only in-bounds words, got text %q", got.Text)
	}
	if got.Start != 3.0 || got.End != 3.6 {
		t.Errorf("expected segment trimmed to [3.0, 3.6], got [%v, %v]", got.Start, got.End)
	}
}
