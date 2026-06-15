// Simulates a network delay
const delay = (ms = 800) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock signup API
 * @returns {{ success: boolean, user_id: number }}
 */
export async function mockSignup({ email, password }) {
  await delay();
  return { success: true, user_id: 15 };
}

/**
 * Mock login API
 * @returns {{ token: string, user_id: number }}
 */
export async function mockLogin({ email, password }) {
  await delay();
  return { token: "jwt_token_here", user_id: 15 };
}

/**
 * Mock video upload API
 * @returns {{ video_id: string, duration: number }}
 */
export async function mockUploadVideo({ file, sport, reelType }) {
  await delay(1200);
  return { video_id: "12345", duration: 5400 };
}
