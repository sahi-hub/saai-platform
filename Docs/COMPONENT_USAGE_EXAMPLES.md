// SAAI UI Component Usage Examples

// ============================================
// 1. ChatLayout Component
// ============================================

import ChatLayout from '@/components/ChatLayout';
import ChatInput from '@/components/ChatInput';

// Basic usage
<ChatLayout 
  tenantName="Demo Store"
  inputComponent={<ChatInput onSendMessage={handleSend} />}
>
  {/* Your messages go here */}
</ChatLayout>

// With custom tenant name
<ChatLayout 
  tenantName="Acme Electronics"
  inputComponent={<ChatInput onSendMessage={handleSend} />}
>
  {messages.map(msg => <MessageBubble key={msg.id} {...msg} />)}
</ChatLayout>

// Default tenant (shows "Guest")
<ChatLayout inputComponent={<ChatInput onSendMessage={handleSend} />}>
  {messages.map(msg => <MessageBubble key={msg.id} {...msg} />)}
</ChatLayout>

// ============================================
// 2. MessageBubble Component
// ============================================

import MessageBubble from '@/components/MessageBubble';

// SAAI message
<MessageBubble 
  message="Hello! How can I help you today?"
  sender="saai"
  timestamp="2:30 PM"
/>

// User message
<MessageBubble 
  message="I need help with my order"
  sender="user"
  timestamp="2:31 PM"
/>

// Without timestamp
<MessageBubble 
  message="Processing your request..."
  sender="saai"
/>

// Long message (auto word-wrap)
<MessageBubble 
  message="Here's a detailed explanation of how our system works. It uses advanced AI to process your requests and provide accurate responses in real-time."
  sender="saai"
  timestamp="2:32 PM"
/>

// ============================================
// 3. ChatInput Component
// ============================================

import ChatInput from '@/components/ChatInput';

// Basic usage
<ChatInput onSendMessage={handleSend} />

// With custom placeholder
<ChatInput 
  onSendMessage={handleSend}
  placeholder="Ask me anything..."
/>

// Handler function example
const handleSend = (text: string) => {
  console.log('User sent:', text);
  // Add to messages array
  setMessages(prev => [...prev, {
    id: Date.now().toString(),
    text,
    sender: 'user',
    timestamp: new Date().toLocaleTimeString()
  }]);
};

// ============================================
// 4. Complete Page Example
// ============================================

'use client';

import { useState, useEffect, useRef } from 'react';
import ChatLayout from '@/components/ChatLayout';
import MessageBubble from '@/components/MessageBubble';
import ChatInput from '@/components/ChatInput';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'saai';
  timestamp: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };

    setMessages(prev => [...prev, newMessage]);

    // TODO: Replace with real API call in STEP 2
    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        text: 'This is a simulated response.',
        sender: 'saai',
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };
      setMessages(prev => [...prev, response]);
    }, 500);
  };

  return (
    <ChatLayout 
      tenantName="My Store"
      inputComponent={<ChatInput onSendMessage={handleSendMessage} />}
    >
      {messages.map(msg => (
        <MessageBubble
          key={msg.id}
          message={msg.text}
          sender={msg.sender}
          timestamp={msg.timestamp}
        />
      ))}
      <div ref={messagesEndRef} />
    </ChatLayout>
  );
}

// ============================================
// 5. TypeScript Interfaces
// ============================================

// ChatLayout props
interface ChatLayoutProps {
  tenantName?: string;      // Optional, defaults to "Guest"
  children: ReactNode;      // Message bubbles
  inputComponent: ReactNode; // ChatInput component
}

// MessageBubble props
interface MessageBubbleProps {
  message: string;           // Required
  sender: 'user' | 'saai';  // Required
  timestamp?: string;        // Optional
}

// ChatInput props
interface ChatInputProps {
  onSendMessage: (message: string) => void; // Required callback
  placeholder?: string;      // Optional, defaults to "Type a message..."
}

// Message data structure
interface Message {
  id: string;               // Unique identifier (use Date.now() or UUID)
  text: string;             // Message content
  sender: 'user' | 'saai'; // Who sent it
  timestamp: string;        // Formatted time string
}

// ============================================
// 6. Styling Customization
// ============================================

// To customize colors, edit the component files directly
// or override with Tailwind classes:

// Example: Custom user message color
<div className="bg-gradient-to-br from-purple-500 to-purple-600">
  {/* User message */}
</div>

// Example: Custom background
<div className="bg-gradient-to-b from-blue-50 to-indigo-100">
  {/* Chat layout */}
</div>

// ============================================
// 7. Mobile WebView Integration (Future)
// ============================================

// When embedding in mobile app WebView:

// 1. Pass tenant from mobile app via URL parameter
const searchParams = new URLSearchParams(window.location.search);
const tenant = searchParams.get('tenant') || 'Guest';

<ChatLayout tenantName={tenant} {...props}>
  {/* ... */}
</ChatLayout>

// 2. Disable zoom (add to layout.tsx)
<meta 
  name="viewport" 
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
/>

// 3. Handle safe areas for iOS notch
<div className="pb-safe-area-inset-bottom">
  {/* Content */}
</div>

// ============================================
// 8. Common Patterns
// ============================================

// Loading state
{isLoading && (
  <MessageBubble 
    message="Typing..." 
    sender="saai"
  />
)}

// Error message
<MessageBubble 
  message="Sorry, something went wrong. Please try again."
  sender="saai"
  timestamp={new Date().toLocaleTimeString()}
/>

// Empty state
{messages.length === 0 && (
  <div className="text-center text-slate-400 py-8">
    No messages yet. Start a conversation!
  </div>
)}

// Grouped messages by date
{messagesGroupedByDate.map(group => (
  <div key={group.date}>
    <div className="text-center text-xs text-slate-400 my-4">
      {group.date}
    </div>
    {group.messages.map(msg => (
      <MessageBubble key={msg.id} {...msg} />
    ))}
  </div>
))}
