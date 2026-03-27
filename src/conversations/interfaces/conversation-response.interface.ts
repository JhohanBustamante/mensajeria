export interface ConversationResponse {
  id: string;
  otherUser: {
    userId: number;
    email: string;
    username: string;
  };
  blocked: boolean;
  blockedReason: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
