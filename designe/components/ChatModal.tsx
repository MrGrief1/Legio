
import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Send, MoreVertical, Paperclip, Smile, Check, CheckCheck, ChevronLeft, MessageCircle, Info as InfoIcon, Shield, Trash2, Image as ImageIcon, FileText, Film, Calendar, User, ArrowUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useDialog } from '../context/DialogContext';

interface Attachment {
    id: number;
    url: string;
    type: 'image' | 'video' | 'file';
    name: string;
}

interface Message {
    id: number;
    chat_id: number;
    sender_id: number;
    content: string;
    is_read: number;
    created_at: string;
    name?: string;
    username?: string;
    avatar?: string;
    attachments?: Attachment[];
}

interface ChatContact {
    id: number;
    type: 'direct' | 'group';
    name: string;
    avatar: string;
    last_message: string;
    last_message_time: string;
    unread_count: number;
    online: boolean;
    otherUserId?: number;
    is_blocked?: boolean;
    bio?: string;
    birthdate?: string;
}

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '💩', '👻', '👋', '🤝', '👀', '🧠', '🤖', '👽'];

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { showAlert, showConfirm } = useDialog();
    const [activeChatId, setActiveChatId] = useState<number | null>(null);
    const [contacts, setContacts] = useState<ChatContact[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [showMobileChat, setShowMobileChat] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showContactInfo, setShowContactInfo] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const prevMessagesLength = useRef(0);

    const activeContact = contacts.find(c => c.id === activeChatId);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen || user) {
            fetchChats();
        }
    }, [isOpen, user]);

    useEffect(() => {
        if (activeChatId) {
            fetchMessages(activeChatId);
            markMessagesAsRead(activeChatId);
            const interval = setInterval(() => {
                fetchMessages(activeChatId);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [activeChatId]);

    useEffect(() => {
        if (isOpen) {
            const interval = setInterval(fetchChats, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen, activeChatId]);

    useEffect(() => {
        // Only scroll if new messages appeared
        if (messages.length > prevMessagesLength.current) {
            scrollToBottom();
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    // Scroll when files are added (optional, but good for UX)
    useEffect(() => {
        if (files.length > 0) scrollToBottom();
    }, [files]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const fetchChats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/chats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                let data = await response.json();

                // If we have an active chat, ensure it shows as read in the list
                if (activeChatId) {
                    data = data.map((c: ChatContact) => c.id === activeChatId ? { ...c, unread_count: 0 } : c);
                }

                setContacts(data);
            }
        } catch (error) {
            console.error('Error fetching chats:', error);
        }
    };

    const handleDeleteMessage = async (messageId: number) => {
        // @ts-ignore
        const confirmed = await showConfirm(t.common?.deleteConfirm || "Удалить сообщение?");
        if (!confirmed) return;

        // Optimistic update
        setMessages(prev => prev.filter(m => m.id !== messageId));

        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:3001/api/chats/${activeChatId}/messages/${messageId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchChats(); // Update last message preview
        } catch (error) {
            console.error('Error deleting message:', error);
            fetchMessages(activeChatId!); // Revert on error
        }
    };

    const fetchMessages = async (chatId: number) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/chats/${chatId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setMessages(data);
                if (activeContact?.unread_count && activeContact.unread_count > 0) {
                    markMessagesAsRead(chatId);
                }
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const markMessagesAsRead = async (chatId: number) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:3001/api/chats/${chatId}/read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            setContacts(prev => prev.map(c => c.id === chatId ? { ...c, unread_count: 0 } : c));
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    };

    const toggleBlockUser = async () => {
        if (!activeContact?.otherUserId) return;

        const isBlocked = activeContact.is_blocked;
        const url = isBlocked
            ? `http://localhost:3001/api/users/block/${activeContact.otherUserId}`
            : 'http://localhost:3001/api/users/block';

        const method = isBlocked ? 'DELETE' : 'POST';
        const body = isBlocked ? undefined : JSON.stringify({ userId: activeContact.otherUserId });

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body
            });

            if (response.ok) {
                setContacts(prev => prev.map(c => c.id === activeChatId ? { ...c, is_blocked: !isBlocked } : c));
            }
        } catch (error) {
            console.error('Error blocking/unblocking user:', error);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!inputValue.trim() && files.length === 0) || !activeChatId) return;

        if (activeContact?.is_blocked) {
            showAlert("Вы заблокировали этого пользователя и не можете отправлять сообщения.");
            return;
        }

        const tempId = Date.now();
        // Optimistic message is harder with files since we need to upload them.
        // For now, we'll just clear input and wait for server response or show a loading state.
        // But to keep it responsive, we can show text immediately.

        const optimisticMessage: Message = {
            id: tempId,
            chat_id: activeChatId,
            sender_id: user?.id || 0,
            content: inputValue,
            is_read: 0,
            created_at: new Date().toISOString(),
            attachments: files.map((f, i) => ({
                id: i,
                url: URL.createObjectURL(f), // Temporary preview URL
                type: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'file',
                name: f.name
            }))
        };

        setMessages(prev => [...prev, optimisticMessage]);
        setInputValue('');
        setFiles([]);
        setShowEmojiPicker(false);

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('content', optimisticMessage.content);
            files.forEach(file => {
                formData.append('files', file);
            });

            const response = await fetch(`http://localhost:3001/api/chats/${activeChatId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const savedMessage = await response.json();
                setMessages(prev => prev.map(m => m.id === tempId ? savedMessage : m));
                fetchChats();
            } else {
                // Revert on error
                const errData = await response.json().catch(() => ({}));
                setMessages(prev => prev.filter(m => m.id !== tempId));
                showAlert(errData.message || t.error || "Не удалось отправить сообщение");
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            showAlert("Ошибка сети");
        }
    };

    const handleContactClick = (id: number) => {
        setActiveChatId(id);
        setShowMobileChat(true);
        setShowContactInfo(false);
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/users/search?query=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSearchResults(data);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    };

    const startChat = async (targetUserId: number) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ targetUserId })
            });

            if (response.ok) {
                const data = await response.json();
                await fetchChats();
                setActiveChatId(data.id);
                setShowMobileChat(true);
                setSearchQuery('');
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Error starting chat:', error);
        }
    };

    const formatTime = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-6 lg:p-8 text-zinc-900 dark:text-white font-sans selection:bg-zinc-300 dark:selection:bg-zinc-700">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Main Window with Solid Colors (No Glass) */}
            <div className="relative w-full max-w-6xl h-full sm:h-[85vh] bg-white dark:bg-black sm:rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col sm:flex-row">

                {/* Background Light Effect (Spotlight) inside Modal */}
                <div className="absolute inset-0 z-0 pointer-events-none flex justify-center overflow-hidden">
                    {/* Dark Mode Spotlight */}
                    <div className="dark:opacity-100 opacity-0 transition-opacity duration-700">
                        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),transparent)] blur-[0px]" />
                        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-white/5 blur-[100px] rounded-full" />
                    </div>
                    {/* Light Mode Ambient Glow */}
                    <div className="dark:opacity-0 opacity-100 transition-opacity duration-700">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-100/50 blur-[120px] rounded-full -translate-y-1/2" />
                    </div>
                </div>

                {/* Left Sidebar - Contact List */}
                <div className={`
            absolute inset-0 z-20 sm:static w-full sm:w-80 md:w-96 flex flex-col border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-300 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl
            ${showMobileChat ? '-translate-x-full sm:translate-x-0' : 'translate-x-0'}
        `}>
                    {/* Sidebar Header */}
                    <div className="p-6 pb-4 flex items-center justify-between">
                        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white font-serif italic tracking-wide drop-shadow-sm">{t.sidebar.chats || 'Чаты'}</h2>
                        <button onClick={onClose} className="sm:hidden p-2 text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-6 pb-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder={t.admin.searchUsers || "Поиск..."}
                                className="w-full bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-blue-500/30 rounded-2xl py-3 pl-11 pr-4 text-sm outline-none text-zinc-900 dark:text-white placeholder-zinc-500 transition-all"
                            />
                        </div>

                    </div>

                        {/* Combined List Area */}
                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
                            {searchResults.length > 0 || searchQuery.length >= 2 ? (
                                // Search Results Inline
                                <div className="space-y-1">
                                    {searchResults.length === 0 ? (
                                        <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                                            Пользователи не найдены
                                        </div>
                                    ) : (
                                        searchResults.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => startChat(user.id)}
                                                className="w-full flex items-center gap-4 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer rounded-[24px] transition-all group text-left animate-in fade-in slide-in-from-bottom-2 duration-300"
                                            >
                                                <div className="relative">
                                                    <img
                                                        src={user.avatar}
                                                        alt={user.username}
                                                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-zinc-800 group-hover:ring-blue-500 transition-all shadow-sm"
                                                    />
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="font-bold text-base text-zinc-900 dark:text-white truncate group-hover:text-blue-500 transition-colors">
                                                        {user.name || user.username}
                                                    </span>
                                                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                                                        @{user.username}
                                                    </span>
                                                </div>
                                                <div className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-sm">
                                                    <MessageCircle size={18} />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            ) : (
                                // Contacts List
                                contacts.map(contact => (
                                    <button
                                        key={contact.id}
                                        onClick={() => handleContactClick(contact.id)}
                                        className={`w-full flex items-center gap-4 p-3.5 rounded-[24px] transition-all duration-200 group relative overflow-hidden ${activeChatId === contact.id
                                            ? 'bg-zinc-100 dark:bg-zinc-900 shadow-sm'
                                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                                            }`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <img src={contact.avatar} alt={contact.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900 shadow-sm" />
                                            {contact.online && (
                                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className={`font-semibold text-[15px] truncate ${activeChatId === contact.id ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-200'}`}>
                                                    {contact.name}
                                                </span>
                                                <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">{formatTime(contact.last_message_time)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <p className={`text-xs truncate max-w-[160px] ${contact.unread_count > 0
                                                    ? 'text-zinc-900 dark:text-white font-medium'
                                                    : 'text-zinc-500 dark:text-zinc-400'
                                                    }`}>
                                                    {contact.last_message}
                                                </p>
                                                {contact.unread_count > 0 && (
                                                    <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-zinc-600 dark:bg-zinc-700 text-white text-[10px] font-bold rounded-full px-1.5 shadow-sm">
                                                        {contact.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                </div>

                {/* Right Side - Chat Area */}
                <div className={`
            absolute inset-0 z-10 sm:static flex-1 flex flex-col bg-transparent transition-transform duration-300
            ${showMobileChat ? 'translate-x-0' : 'translate-x-full sm:translate-x-0'}
        `}>
                    {activeChatId && activeContact ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-20 flex items-center justify-between px-6 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-black/80 backdrop-blur-xl sticky top-0 z-20">
                                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setShowContactInfo(true)}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMobileChat(false); }}
                                        className="sm:hidden p-2 -ml-2 text-zinc-500 hover:text-black dark:hover:text-white"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <div className="relative">
                                        <img src={activeContact.avatar} alt={activeContact.name} className="w-10 h-10 rounded-full ring-2 ring-white dark:ring-zinc-900 shadow-sm" />
                                        {activeContact.online && (
                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-zinc-900 dark:text-white text-base">{activeContact.name}</h3>
                                        <p className={`text-xs font-bold ${activeContact.online ? 'text-green-600 dark:text-green-400' : 'text-blue-500 dark:text-blue-400'}`}>
                                            {activeContact.online ? 'В сети' : 'Был(а) недавно'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <button
                                        onClick={() => setShowContactInfo(!showContactInfo)}
                                        className={`p-2.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all ${showContactInfo ? 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' : 'hover:text-zinc-900 dark:hover:text-white'}`}
                                    >
                                        <MoreVertical size={20} />
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="hidden sm:block ml-2 p-2.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 relative overflow-hidden flex bg-transparent">
                                <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${showContactInfo ? 'mr-0 lg:mr-80' : ''}`}>
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
                                        {messages.map((msg) => {
                                            const isMe = msg.sender_id === user?.id;
                                            return (
                                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in slide-in-from-bottom-2 duration-300`}>
                                                    <div
                                                        className={`max-w-[85%] sm:max-w-[70%] px-5 py-3.5 rounded-[24px] relative shadow-md group-hover:shadow-lg transition-all ${isMe
                                                                ? 'bg-blue-600 text-white rounded-br-none'
                                                                : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-bl-none'
                                                            }`}
                                                    >
                                                        {isMe && (
                                                            <button
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                                title="Удалить"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                        {msg.attachments && msg.attachments.length > 0 && (
                                                            <div className="mb-2 grid gap-2">
                                                                {msg.attachments.map(att => (
                                                                    <div key={att.id} className="rounded-lg overflow-hidden">
                                                                        {att.type === 'image' ? (
                                                                            <img src={att.url} alt="attachment" className="max-w-full rounded-lg" />
                                                                        ) : att.type === 'video' ? (
                                                                            <video src={att.url} controls className="max-w-full rounded-lg" />
                                                                        ) : (
                                                                            <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-black/10 rounded-lg hover:bg-black/20 transition-colors">
                                                                                <FileText size={16} />
                                                                                <span className="text-sm underline">{att.name}</span>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                        <div className={`flex items-center justify-end gap-1.5 mt-1.5 text-[10px] font-medium ${isMe ? 'text-blue-200' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                                            <span>{formatTime(msg.created_at)}</span>
                                                            {isMe && (
                                                                !!msg.is_read ? <CheckCheck size={14} /> : <Check size={14} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input Area */}
                                    {!activeContact.is_blocked ? (
                                        <div className="p-4 sm:p-5 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-zinc-200/50 dark:border-zinc-800/50">
                                            {/* File Previews */}
                                            {files.length > 0 && (
                                                <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                                                    {files.map((file, idx) => (
                                                        <div key={idx} className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 group">
                                                            {file.type.startsWith('image/') ? (
                                                                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="preview" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                                                    <FileText size={24} />
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={() => removeFile(idx)}
                                                                className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <form
                                                onSubmit={handleSendMessage}
                                                className="flex items-center gap-2 p-2"
                                            >
                                                <div className="flex-1 flex items-center gap-2 bg-zinc-100/80 dark:bg-zinc-900/80 p-1.5 rounded-[24px] border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-700 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all shadow-sm backdrop-blur-sm">
                                                    <input
                                                        type="file"
                                                        multiple
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        onChange={handleFileSelect}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="p-2 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                                                    >
                                                        <Paperclip size={20} />
                                                    </button>

                                                    <div className="flex-1 py-2 relative">
                                                        <textarea
                                                            value={inputValue}
                                                            onChange={(e) => setInputValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleSendMessage();
                                                                }
                                                            }}
                                                            placeholder="Написать сообщение..."
                                                            rows={1}
                                                            className="w-full bg-transparent border-none outline-none text-[15px] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 resize-none custom-scrollbar max-h-32 flex items-center"
                                                            style={{ minHeight: '24px' }}
                                                        />
                                                    </div>

                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                            className={`p-2 rounded-full transition-all ${showEmojiPicker ? 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                                                        >
                                                            <Smile size={20} />
                                                        </button>

                                                        {/* Emoji Picker Popover */}
                                                        {showEmojiPicker && (
                                                            <div className="absolute bottom-12 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl rounded-2xl p-3 grid grid-cols-4 gap-2 w-64 z-50 animate-in zoom-in-95 duration-200">
                                                                {EMOJIS.map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setInputValue(prev => prev + emoji);
                                                                            setShowEmojiPicker(false);
                                                                        }}
                                                                        className="text-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded-xl transition-colors"
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={!inputValue.trim() && files.length === 0}
                                                    className={`w-[42px] h-[42px] flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-200 ${inputValue.trim() || files.length > 0
                                                            ? 'bg-white text-black hover:bg-zinc-200 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-md'
                                                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                                                        }`}
                                                >
                                                    <ArrowUp size={20} strokeWidth={2.5} />
                                                </button>
                                            </form>
                                        </div>
                                    ) : (
                                        <div className="p-4 sm:p-5 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 dark:text-zinc-400">
                                            Вы заблокировали этого пользователя.
                                        </div>
                                    )}
                                </div>

                                {/* Contact Info Sidebar (Overlay/Slide-in) */}
                                <div className={`
                            absolute top-0 right-0 bottom-0 w-full lg:w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl transition-transform duration-300 transform z-30
                            ${showContactInfo ? 'translate-x-0' : 'translate-x-full'}
                        `}>
                                    <div className="h-full flex flex-col">
                                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                            <h3 className="font-serif italic text-xl font-bold text-zinc-900 dark:text-white">Информация</h3>
                                            <button onClick={() => setShowContactInfo(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                            <div className="flex flex-col items-center mb-8">
                                                <div className="relative group cursor-pointer">
                                                    <img src={activeContact.avatar} alt={activeContact.name} className="w-28 h-28 rounded-full mb-4 shadow-2xl ring-4 ring-white dark:ring-zinc-800 object-cover" />
                                                    <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                        <User size={32} />
                                                    </div>
                                                </div>
                                                <h4 className="text-2xl font-bold mb-1 text-zinc-900 dark:text-white">{activeContact.name}</h4>
                                                <p className="text-zinc-500 font-medium">@{activeContact.name}</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="p-5 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                                    <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-widest font-bold mb-3">
                                                        <InfoIcon size={12} />
                                                        О пользователе
                                                    </div>
                                                    <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                                                        {activeContact.bio || 'Информация отсутствует'}
                                                    </p>
                                                </div>

                                                {activeContact.birthdate && (
                                                    <div className="p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center gap-4">
                                                        <div className="p-2.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                                                            <Calendar size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-zinc-400 font-bold uppercase tracking-wide">День рождения</div>
                                                            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{formatDate(activeContact.birthdate)}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="pt-4 space-y-3">
                                                    <button
                                                        onClick={toggleBlockUser}
                                                        className={`w-full p-4 rounded-2xl border flex items-center justify-center gap-3 transition-all font-medium ${activeContact.is_blocked
                                                                ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
                                                                : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/20 hover:text-red-600 dark:hover:text-red-400 text-zinc-700 dark:text-zinc-300'
                                                            }`}
                                                    >
                                                        <Shield size={20} />
                                                        <span>{activeContact.is_blocked ? 'Разблокировать' : 'Заблокировать'}</span>
                                                    </button>

                                                    <button className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-3 text-red-600 dark:text-red-400 transition-all font-medium">
                                                        <Trash2 size={20} />
                                                        <span>Удалить чат</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                            <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 ring-8 ring-zinc-50 dark:ring-zinc-800/50">
                                <MessageCircle size={48} className="opacity-30" />
                            </div>
                            <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">Выберите чат для начала общения</p>
                            <p className="text-sm text-zinc-400 mt-2">Или найдите пользователя через поиск</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
