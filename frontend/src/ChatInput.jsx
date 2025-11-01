import React, { useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa';

function ChatInput({ onSendMessage }) {
  const [inputValue, setInputValue] = useState('');

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder="Type a message..."
        aria-label="Chat message input"
      />
      <button type="submit" aria-label="Send Message">
        <FaPaperPlane />
      </button>
    </form>
  );
}

export default ChatInput;