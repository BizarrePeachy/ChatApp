import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getMessages, sendMessage } from "../services/api"; // Adjust the path if needed
import { useNavigate } from "react-router-dom";
import "../styles/ChatPage.css";

// --- Types ---
interface Message {
  id: string;
  userId: string;
  username: string; // Include username in the Message interface
  content: string;
  timestamp: number;
}

// --- Constants ---
const MESSAGE_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.1 } },
};

// --- Helper Components ---

// Displays a single message
const MessageItem: React.FC<{ message: Message }> = ({ message }) => {
  const messageTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <motion.div
      variants={MESSAGE_ANIMATION_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="NewMessageStyle"
    >
      <div>
        <div className="TopMessageStyle">
          <span className="UsernameMessage">User: {message.userId}</span>
          <span className="TimeStampMessage">{messageTime}</span>
        </div>
        <p>{message.content}</p>
      </div>
    </motion.div>
  );
};

// Displays the list of messages in a channel
const MessageList: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={chatContainerRef} className="ChatContainer">
      <AnimatePresence>
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Input area for sending messages
const MessageInput: React.FC<{
  channelId: number;
  onSendMessage: (message: Message) => void;
}> = ({ channelId, onSendMessage }) => {
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    if (messageText.trim()) {
      setIsLoading(true);
      try {
        //  Modified to include username in the new message.
        const response = await sendMessage(1, channelId, messageText);
        const newMessage: Message = response.data;
        onSendMessage(newMessage);
        setMessageText("");
        if (inputRef.current) {
          inputRef.current.style.height = "auto";
        }
      } catch (error: any) {
        console.error("Error sending message:", error);
        if (error.response?.status === 401) {
          alert("You are logged out. Please log in again.");
          localStorage.removeItem("authToken");
          localStorage.removeItem("userId");
          document.cookie = "authToken=; Max-Age=0";
          window.location.href = "/";
        }
      } finally {
        setIsLoading(false);
      }
    }
  }, [channelId, onSendMessage, messageText]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [messageText]);

  return (
    <div className="MessageInput">
      <textarea
        ref={inputRef}
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        placeholder="Type your message..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        disabled={isLoading}
        rows={1}
        className="MessageTextArea"
      />
      <button onClick={handleSend} disabled={isLoading}>
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
};

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [channelId, setChannelId] = useState<number>(1);
  const [username, setUsername] = useState("");

  const handleSendMessage = useCallback((newMessage: Message) => {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  }, []);

  // Fetch initial messages and set up polling
  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      if (!isMounted) return;
      setLoading(true);
      try {
        //  Modified to fetch messages *with* usernames.  This is the key change.
        const initialMessagesResponse = await getMessages(1, channelId);
        if (isMounted) {
          setMessages(initialMessagesResponse.data);
        }
      } catch (error: any) {
        console.error("Error fetching messages:", error);
        if (error.response?.status === 401) {
          alert("You are logged out. Please log in again.");
          localStorage.removeItem("authToken");
          localStorage.removeItem("userId");
          document.cookie = "authToken=; Max-Age=0";
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const fetchUsername = () => {
      const storedUsername = localStorage.getItem("username");
      if (storedUsername) {
        setUsername(storedUsername);
      }
    };

    fetchMessages();
    fetchUsername();

    const intervalId = setInterval(async () => {
      if (!isMounted) return;
      try {
        //  Modified to fetch *new* messages *with* usernames.
        const newMessagesResponse = await getMessages(1, channelId);

        if (newMessagesResponse.data.length > messages.length) {
          if (isMounted) {
            const newMessages = newMessagesResponse.data.slice(messages.length);
            setMessages((prevMessages) => [...prevMessages, ...newMessages]);
          }
        }
      } catch (error: any) {
        console.error("Error fetching new messages:", error);
        if (error.response?.status === 401) {
          alert("You are logged out. Please log in again.");
          localStorage.removeItem("authToken");
          localStorage.removeItem("username");
          localStorage.removeItem("userId");
          document.cookie = "authToken=; Max-Age=0";
          navigate("/");
        }
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [channelId, navigate, messages.length]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    document.cookie = "authToken=; Max-Age=0";
    navigate("/");
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="MainChatDiv">
      <h1 className="ChatHeader">Chat</h1>
      <div className="TopArea">
        <p className="UsernameText">Loggin in as: {username}</p>
        <button className="LogoutButton" onClick={handleLogout}>
          Logout
        </button>
      </div>
      <MessageList messages={messages} />
      <MessageInput channelId={channelId} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatPage;
