export interface MainApiUserSummary {
  userId: number;
  email: string;
  username: string;
}

export interface ChatEligibilityResponse {
  allowed: boolean;
  requesterUser: MainApiUserSummary;
  targetUser: MainApiUserSummary;
}
