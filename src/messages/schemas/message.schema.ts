import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({
  collection: 'messages',
  timestamps: false,
})
export class Message {
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  })
  conversationId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  senderUserId: number;

  @Prop({ type: String, required: true })
  senderEmail: string;

  @Prop({ type: String, required: true })
  senderUsername: string;

  @Prop({ type: String, required: true, maxlength: 1000 })
  content: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  sentAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, sentAt: -1 });
MessageSchema.index({ senderEmail: 1 });
