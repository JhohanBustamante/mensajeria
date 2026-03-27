import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({
  collection: 'conversations',
  timestamps: true,
})
export class Conversation {
  @Prop({ type: String, required: true, unique: true, index: true })
  conversationKey: string;

  @Prop({ type: [Number], required: true })
  participantsUserIds: number[];

  @Prop({ type: [String], required: true })
  participantsEmails: string[];

  @Prop({ type: [String], required: true })
  participantsUsernames: string[];

  @Prop({ type: Boolean, default: false })
  blocked: boolean;

  @Prop({ type: String, default: null })
  blockedReason: string | null;

  @Prop({ type: String, default: null })
  lastMessage: string | null;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ participantsEmails: 1 });
ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ blocked: 1 });
