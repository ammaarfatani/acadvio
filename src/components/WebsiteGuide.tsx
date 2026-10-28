"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X,
  Send,
  ArrowUpRight,
  Minus,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { answerWebsiteQuestion } from "@/lib/website-guide";
import { Presence, TypingDots } from "./Motion";
type Message = {
  role: "user" | "guide";
  text: string;
  links?: { href: string; label: string }[];
};
function GuideMark() {
  return (
    <span className="ac-guide-mark" aria-hidden="true">
      <svg viewBox="0 0 28 30" fill="none">
        <path
          d="M4 12L14 6L24 12M4 19L14 13L24 19M4 26L14 20L24 26"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="5" r="2" fill="currentColor" />
      </svg>
    </span>
  );
}
export function WebsiteGuide() {
  const [open, setOpen] = useState(false),
    [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "guide",
      text: "Welcome to Acadivo. I can help you explore the platform, compare plans or get your school started. English aur Roman Urdu mein pooch sakte hain.",
    },
  ]);
  const [typing, setTyping] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pending = useRef(false),
    input = useRef<HTMLInputElement>(null),
    launcher = useRef<HTMLButtonElement>(null),
    history = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [messages, open, typing]);
  useEffect(
    () => () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    },
    [],
  );
  const ask = (text: string) => {
    if (!text.trim() || pending.current) return;
    pending.current = true;
    const reply = answerWebsiteQuestion(text);
    setMessages((previous) => [
      ...previous.slice(-38),
      { role: "user", text: text.trim().slice(0, 800) },
    ]);
    setQuestion("");
    setTyping(true);
    replyTimer.current = setTimeout(() => {
      setMessages((previous) => [
        ...previous,
        { role: "guide", text: reply.answer, links: reply.links },
      ]);
      pending.current = false;
      setTyping(false);
      replyTimer.current = null;
      input.current?.focus();
    }, 1600);
  };
  return (
    <div className="m-website-guide ac-guide">
      <Presence show={open} kind="chat">
        <section
          id="website-guide"
          aria-label="Acadivo website guide"
          className="ac-chat"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <header className="ac-chat-header">
            <div className="ac-chat-brand">
              <GuideMark />
              <div>
                <span>YOUR ACADIVO COMPANION</span>
                <h2>Let’s find your next step.</h2>
                <p>Product & company guidance</p>
              </div>
            </div>
            <div className="ac-chat-controls">
              <button
                type="button"
                aria-label="Minimize website guide"
                onClick={close}
              >
                <Minus size={17} />
              </button>
              <button
                type="button"
                aria-label="Close website guide"
                onClick={close}
              >
                <X size={17} />
              </button>
            </div>
          </header>
          <div ref={history} className="ac-chat-history">
            <div className="ac-chat-date">
              <span />A better-connected school starts here
              <span />
            </div>
            <div role="log" aria-live="polite" aria-relevant="additions">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`ac-message motion-message ac-message-${message.role}`}
                >
                  <p className="ac-message-label">
                    {message.role === "user" ? "You" : "Acadivo guide"}
                  </p>
                  <div className="ac-message-bubble">{message.text}</div>
                  {message.links && (
                    <div className="ac-message-links">
                      {message.links.map((link) => (
                        <Link key={link.href} href={link.href} onClick={close}>
                          {link.label}
                          <ArrowUpRight size={13} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {typing && (
                <div role="status" className="ac-chat-typing">
                  <GuideMark />
                  <div>
                    <TypingDots />
                    <span>Acadivo is typing…</span>
                  </div>
                </div>
              )}
            </div>
            {messages.length === 1 && (
              <div className="ac-chat-suggestions">
                <p>A GOOD PLACE TO START</p>
                {[
                  "How does the free trial work?",
                  "Which plan suits my school?",
                  "Do you provide portal guides?",
                ].map((text) => (
                  <button
                    type="button"
                    key={text}
                    disabled={typing}
                    onClick={() => ask(text)}
                  >
                    {text}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ac-chat-composer">
            <div className="ac-chat-quick">
              {["Free trial", "Pricing & payment", "Company contact"].map(
                (text) => (
                  <button
                    type="button"
                    key={text}
                    disabled={typing}
                    onClick={() => ask(text)}
                  >
                    {text}
                  </button>
                ),
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              <input
                ref={input}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={800}
                aria-label="Your question"
                placeholder="What would you like to know?"
              />
              <button
                type="submit"
                disabled={!question.trim() || typing}
                aria-label="Send question"
              >
                <Send size={17} />
              </button>
            </form>
            <p>
              <BookOpen size={11} /> Public product guidance. School records
              stay private.
            </p>
          </div>
        </section>
      </Presence>
      <button
        ref={launcher}
        type="button"
        className="ac-guide-launcher"
        aria-label={open?"Close guide":"Ask Acadivo"}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="website-guide"
      >
        <GuideMark />
        <span>
          <strong>{open ? "Close guide" : "Ask Acadivo"}</strong>
          <small>Your school, explained.</small>
        </span>
        {open ? <X size={17} /> : <ArrowRight size={17} />}
      </button>
    </div>
  );
}
