import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaPaperPlane, FaTrash, FaHeart, FaPaperclip } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../context/ThemeContext';
import { requestAI } from '../util/ai';
import { extractPdfText } from '../util/pdf';

const STORAGE_KEY = 'cl_ai_chat_history';

const QUICK_PROMPTS = [
  'Summarize this topic for me 📝',
  'Give me 5 practice questions 🧠',
  'Explain this like I\'m 5 🎯',
  'What are common exam mistakes? ⚠️',
];
const MAX_NOTES_LENGTH = 100000;

export default function AIBuddy() {
  const { darkMode } = useTheme();
  const dm = darkMode;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [{
        role: 'assistant',
        content: "Hi! I'm **Gooloogulu** 🧸, your CampusLearn study buddy!\n\nI can explain tricky topics, answer all parts of your questions, make practice questions, and summarize notes you attach. What are we studying today?",
      }];
    } catch {
      return [{
        role: 'assistant',
        content: "Hi! I'm **Gooloogulu** 🧸, your CampusLearn study buddy! What are we studying today?",
      }];
    }
  });
  const [input, setInput] = useState('');
  const [attachedNotes, setAttachedNotes] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Persist chat history
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;
    const assistantMessageId = crypto.randomUUID();
    setInput('');
    setMessages(prev => [
      ...prev,
      { role: 'user', content: msg },
      { id: assistantMessageId, role: 'assistant', content: '' },
    ]);
    setIsTyping(true);

    // Detect subject context from URL
    const path = window.location.pathname;
    const context = path.includes('/subject/')
      ? `Student is browsing subject page: ${decodeURIComponent(path.split('/').pop())}.`
      : '';

    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));
      const notes = attachedNotes
        .filter((note) => !note.isPdf)
        .map(({ name, content }) => `--- ${name} ---\n${content}`)
        .join('\n\n');
      const pdfDocuments = attachedNotes
        .filter((note) => note.isPdf)
        .map(({ name, content }) => ({ name, text: content }));
      await requestAI({
        message: msg,
        context,
        notes,
        pdfDocuments,
        history,
        onToken: (token) => setMessages((prev) => prev.map((item) =>
          item.id === assistantMessageId ? { ...item, content: item.content + token } : item
        )),
      });
    } catch (err) {
      setMessages((prev) => prev.map((item) => item.id === assistantMessageId
        ? {
          ...item,
          content: item.content
            ? `${item.content}\n\n*Gooloogulu's response was interrupted.*`
            : `**Gooloogulu couldn't respond.**\n\n${err.message || 'Please check your connection and try again.'}`,
        }
        : item
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const handleAttachNotes = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    setAttachmentError('');
    if (!files.length) return;

    try {
      const newNotes = await Promise.all(files.map(async (file) => {
        if (/\.pdf$/i.test(file.name)) {
          return {
            name: file.name,
            content: await extractPdfText(new Uint8Array(await file.arrayBuffer())),
            isPdf: true,
          };
        }
        if (!/\.(txt|md|csv)$/i.test(file.name)) {
          throw new Error('Attach a PDF, TXT, Markdown, or CSV file.');
        }
        return { name: file.name, content: await file.text(), isPdf: false };
      }));
      const combinedLength = [...attachedNotes, ...newNotes]
        .reduce((total, note) => total + note.content.length, 0);
      if (combinedLength > MAX_NOTES_LENGTH) {
        throw new Error('Attached notes must total 100,000 characters or fewer.');
      }
      setAttachedNotes((current) => [...current, ...newNotes]);
    } catch (error) {
      setAttachmentError(error.message || 'Could not read that file.');
    }
  };

  const clearChat = () => {
    const initial = [{
      role: 'assistant',
      content: "Chat cleared! Gooloogulu is ready to help you study. What topic shall we tackle? 📚",
    }];
    setMessages(initial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <button
              onClick={() => setIsOpen(true)}
              aria-label="Open Gooloogulu"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl hover:shadow-indigo-500/50 transition-shadow relative"
            >
              <span aria-hidden="true">🤖</span>
              <FaHeart className="absolute bottom-2 right-2 text-[9px] text-pink-200" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bottom-6 right-6 z-50 w-full max-w-[380px] h-[600px] max-h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
              dm ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl" aria-hidden="true">🧸</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">Gooloogulu</h3>
                  <p className="text-[10px] text-indigo-200 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Groq · GPT-OSS 120B
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  title="Clear chat"
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-sm"
                >
                  <FaTrash className="text-xs opacity-70" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${dm ? 'bg-gray-900/50' : 'bg-gray-50/50'}`}>
              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs mr-2 mt-1 shrink-0">
                      🧸
                    </div>
                  )}
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : dm
                        ? 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                        : 'bg-white text-gray-700 rounded-bl-sm border border-gray-100'
                  }`}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-3 prose-a:text-indigo-400 prose-strong:text-current dark:prose-invert">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {isTyping && messages[messages.length - 1]?.content === '' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs mr-2 mt-1 shrink-0">
                    🧸
                  </div>
                  <div className={`rounded-2xl rounded-bl-sm px-4 py-4 flex gap-1 ${dm ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts (shown only if no messages from user yet) */}
            {messages.filter(m => m.role === 'user').length === 0 && (
              <div className={`px-3 pb-1 flex gap-1.5 flex-wrap ${dm ? 'bg-gray-950' : 'bg-white'}`}>
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSend(p)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                      dm
                        ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-indigo-900 hover:border-indigo-600'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {attachedNotes.length > 0 && (
              <div className={`px-3 pt-2 flex flex-wrap gap-1.5 ${dm ? 'bg-gray-950' : 'bg-white'}`}>
                {attachedNotes.map((note, index) => (
                  <button
                    key={`${note.name}-${index}`}
                    type="button"
                    onClick={() => setAttachedNotes((current) => current.filter((_, i) => i !== index))}
                    title={`Remove ${note.name}`}
                    className={`max-w-full truncate text-[11px] px-2 py-1 rounded-lg border ${dm ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}
                  >
                    {note.name} ×
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleSend('Please summarize my attached notes, highlighting the key ideas and important details.')}
                  disabled={isTyping}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  Summarize notes
                </button>
              </div>
            )}

            {/* Input Area */}
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className={`p-4 shrink-0 border-t ${dm ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-100'}`}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,application/pdf,text/plain,text/markdown,text/csv"
                multiple
                onChange={handleAttachNotes}
                className="hidden"
                aria-label="Attach study notes"
              />
              {attachmentError && <p role="alert" className="mb-2 text-xs text-red-500">{attachmentError}</p>}
              <div className={`flex items-center gap-2 rounded-2xl border pr-2 overflow-hidden transition-colors ${
                dm ? 'bg-gray-900 border-gray-800 focus-within:border-indigo-500' : 'bg-gray-50 border-gray-200 focus-within:border-indigo-400'
              }`}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach notes or a PDF"
                  aria-label="Attach notes"
                  className="ml-2 w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors"
                >
                  <FaPaperclip />
                </button>
                <input
                  type="text"
                  placeholder="Ask Gooloogulu anything…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 bg-transparent py-3 px-4 outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    !input.trim() || isTyping
                      ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30'
                  }`}
                >
                  <FaPaperPlane className="text-xs ml-0.5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
