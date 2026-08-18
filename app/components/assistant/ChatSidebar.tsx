import { useState, useRef, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Icon,
  Spinner,
  Divider,
} from "@shopify/polaris";
import {
  ChatIcon,
  DeliveryIcon,
  StarIcon,
  ImportIcon,
  XIcon,
  ArrowUpIcon,
  PersonIcon
} from "@shopify/polaris-icons";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "message" | "confirmation" | "requires_input";
  actionId?: string;
  intent?: string;
  data?: any;
  inputType?: string;
}

const MODULES = [
  {
    id: "subscription",
    title: "Subscription",
    description: "Manage subscription rules and products",
    icon: ChatIcon,
    suggestions: [
      "Add a Plan?",
      "Add products to a Plan",
      "Show all active subscription rules"
    ]
  },
  {
    id: "shipping",
    title: "Shipping Rules",
    description: "Create and manage custom shipping rules",
    icon: DeliveryIcon,
    suggestions: [
      "Create free shipping above $100",
      "Create $10 shipping for orders below $50",
      "Show my active shipping rules"
    ]
  },
  {
    id: "reviews",
    title: "Reviews",
    description: "Understand and manage customer reviews",
    icon: StarIcon,
    suggestions: [
      "Show pending reviews",
      "How many approved reviews do I have?",
      "Show 1-star reviews"
    ]
  },
  {
    id: "migration",
    title: "Migration",
    description: "Manage Shopify migration",
    icon: ImportIcon,
    suggestions: [
      "Import products",
      "Migrate customers to Shopify",
      "Show failed migrations"
    ]
  }
];

export function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({
    subscription: [],
    shipping: [],
    reviews: [],
    migration: []
  });
  const [inputValue, setInputValue] = useState("");

  const fetcher = useFetcher<any>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && activeSection) {
      scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages, activeSection, isOpen]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && activeSection) {
      if (fetcher.data.error) {
        addMessage(activeSection, {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error: ${fetcher.data.error}`
        });
      } else if (fetcher.data.messages && Array.isArray(fetcher.data.messages)) {
        setMessages(prev => {
          const newMsgs = fetcher.data.messages.map((msgData: any, idx: number) => ({
            id: Date.now().toString() + idx,
            role: "assistant" as const,
            content: msgData.message || "",
            type: msgData.type,
            actionId: msgData.actionId,
            intent: msgData.intent,
            data: msgData.data,
            inputType: msgData.inputType,
          }));
          return {
            ...prev,
            [activeSection]: [...(prev[activeSection] || []), ...newMsgs]
          };
        });
      } else if (fetcher.data.type || fetcher.data.success) {
        addMessage(activeSection, {
          id: Date.now().toString(),
          role: "assistant",
          content: fetcher.data.message || "",
          type: fetcher.data.type,
          actionId: fetcher.data.actionId,
          intent: fetcher.data.intent,
          data: fetcher.data.data,
          inputType: fetcher.data.inputType,
        });
      }
    }
  }, [fetcher.state, fetcher.data]);

  const addMessage = (section: string, msg: Message) => {
    setMessages(prev => ({
      ...prev,
      [section]: [...(prev[section] || []), msg]
    }));
  };

  const handleSend = (e?: React.FormEvent, predefinedMessage?: string) => {
    if (e) e.preventDefault();
    const textToSend = predefinedMessage || inputValue;
    if (!textToSend.trim() || !activeSection) return;

    addMessage(activeSection, {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
    });

    if (!predefinedMessage) {
      setInputValue("");
    }

    const formData = new FormData();
    formData.append("message", textToSend);
    formData.append("section", activeSection);
    fetcher.submit(formData, { method: "POST", action: "/api/assistant" });
  };

  const handleConfirm = (actionId: string, actionUrl: string, additionalPayload?: any) => {
    if (!activeSection) return;

    setMessages(prev => ({
      ...prev,
      [activeSection]: prev[activeSection].map(m => m.actionId === actionId ? { ...m, type: "message" } : m)
    }));

    const formData = new FormData();
    formData.append("actionId", actionId);
    if (additionalPayload) {
      formData.append("payload", JSON.stringify(additionalPayload));
    }

    fetcher.submit(formData, { method: "POST", action: actionUrl });
  };

  const submitHiddenMessage = (textToDisplay: string, payload: any, actionId: string) => {
    if (!activeSection) return;
    addMessage(activeSection, {
      id: Date.now().toString(),
      role: "user",
      content: textToDisplay,
    });
    const formData = new FormData();
    formData.append("message", JSON.stringify(payload));
    formData.append("section", activeSection);
    formData.append("actionId", actionId);
    fetcher.submit(formData, { method: "POST", action: "/api/assistant" });
  };

  const handleSelectProducts = async (actionId: string, intentData: any) => {
    const options: any = { type: "product", multiple: true };
    if (intentData && intentData.initialSelectionIds) {
      options.initialSelectionIds = intentData.initialSelectionIds;
    }
    // @ts-ignore
    const selection = await shopify.resourcePicker(options);
    if (selection && selection.length > 0) {
      const productIds = selection.map((p: any) => p.id);
      const titles = selection.map((p: any) => p.title);
      submitHiddenMessage(`Selected ${productIds.length} products.`, { productIds, titles }, actionId);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    fetch("/api/assistant/action/reset", { method: "POST" }).catch(console.error);

    setMessages({
      subscription: [],
      shipping: [],
      reviews: [],
      migration: []
    });
    setActiveSection(null);
  };

  return (
    <>
      {/* Floating Action Button */}
      <div style={{ position: "fixed", bottom: "40px", right: "40px", zIndex: 1000 }}>
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #FF0080 0%, #7928CA 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 25px',
              borderRadius: '50px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(121, 40, 202, 0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(121, 40, 202, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(121, 40, 202, 0.4)';
            }}
          >
            <div style={{ filter: 'brightness(0) invert(1)', display: 'flex' }}>
              <Icon source={ChatIcon} />
            </div>
            AI Assistant
          </button>
        )}
      </div>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1001, backgroundColor: "rgba(0,0,0,0.2)" }}
          onClick={handleClose}
        />
      )}

      {/* Slide-out Sidebar Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          right: isOpen ? 0 : "-450px",
          width: "450px",
          maxWidth: "100%",
          backgroundColor: "#ffffff",
          boxShadow: "-4px 0 16px rgba(0,0,0,0.1)",
          zIndex: 1002,
          display: "flex",
          flexDirection: "column",
          transition: "right 0.3s ease-in-out"
        }}
      >
        {/* Header */}
        {/* Header */}
        <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #FF0080 0%, #7928CA 100%)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {activeSection ? (
            <button 
              style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer', padding: 0 }}
              onClick={() => {
                setActiveSection(null);
                fetch("/api/assistant/action/reset", { method: "POST" }).catch(console.error);
              }}>
              ← Back
            </button>
          ) : (
            <h2 style={{ color: "white", margin: 0, fontSize: "16px", fontWeight: 600 }}>Smart Assistant</h2>
          )}
          <button 
             style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} 
             onClick={handleClose}
          >
             <div style={{ filter: 'brightness(0) invert(1)', display: 'flex' }}>
                <Icon source={XIcon} />
             </div>
          </button>
        </div>

        {/* Dashboard View */}
        {!activeSection && (
          <div style={{ padding: "20px", flex: 1, overflowY: "auto", backgroundColor: "#f9fafb" }}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <Text as="h3" variant="headingLg">How can I help you today?</Text>
            </div>
            <BlockStack gap="400">
              {MODULES.map((mod) => (
                <div key={mod.id} onClick={() => setActiveSection(mod.id)} style={{ cursor: "pointer" }}>
                  <Card padding="400">
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{ padding: "8px", backgroundColor: "#f4f6f8", borderRadius: "8px" }}>
                        <Icon source={mod.icon} tone="base" />
                      </div>
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">{mod.title}</Text>
                        <Text as="p" tone="subdued">{mod.description}</Text>
                      </BlockStack>
                    </InlineStack>
                  </Card>
                </div>
              ))}
            </BlockStack>
          </div>
        )}

        {/* Chat View */}
        {activeSection && (() => {
          const activeModule = MODULES.find(m => m.id === activeSection)!;
          const currentMessages = messages[activeSection] || [];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Assistant Greeting */}
                <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flexShrink: 0, padding: '6px', backgroundColor: '#f4f6f8', borderRadius: '50%' }}>
                    <Icon source={activeModule.icon} tone="base" />
                  </div>
                  <div style={{ maxWidth: '80%', padding: '12px 16px', borderRadius: '16px 16px 16px 0', backgroundColor: '#f4f6f8', color: '#202223' }}>
                    <Text as="p">What would you like to do with your {activeModule.title.toLowerCase()}?</Text>
                    <div style={{ marginTop: '12px' }}>
                      <Text as="p" fontWeight="bold">Suggestions:</Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {activeModule.suggestions.map((suggestion, idx) => (
                          <div key={idx}>
                            <Button size="micro" onClick={() => handleSend(undefined, suggestion)}>{suggestion}</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                {currentMessages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '12px', alignItems: 'flex-end' }}>

                    {msg.role === 'assistant' && (
                      <div style={{ flexShrink: 0, padding: '6px', backgroundColor: '#f4f6f8', borderRadius: '50%' }}>
                        <Icon source={activeModule.icon} tone="base" />
                      </div>
                    )}

                    <div style={{
                      maxWidth: '80%',
                      padding: '12px 16px',
                      borderRadius: msg.role === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                      backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f4f6f8',
                      color: '#202223',
                      border: msg.role === 'assistant' ? '1px solid #e1e3e5' : 'none'
                    }}>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                        {msg.content.split('\n').map((line, i) => {
                          // Simple bold parser for **text**
                          const parts = line.split(/(\*\*.*?\*\*)/g);
                          return (
                            <div key={i} style={{ minHeight: line === '' ? '1em' : 'auto' }}>
                              {parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return <strong key={j}>{part.slice(2, -2)}</strong>;
                                }
                                return <span key={j}>{part}</span>;
                              })}
                            </div>
                          );
                        })}
                      </div>

                      {msg.type === "confirmation" && msg.actionId && (
                        <div style={{ marginTop: '12px' }}>
                          {msg.data && (
                            <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", marginBottom: "12px", border: "1px solid #dfe3e8", fontSize: "13px" }}>
                              <BlockStack gap="100">
                                {Object.entries(msg.data).map(([key, value]) => (
                                  key !== 'intent' && <div key={key}><strong>{key}:</strong> {String(value)}</div>
                                ))}
                              </BlockStack>
                            </div>
                          )}
                          <InlineStack gap="300">
                            <Button tone="success" onClick={() => handleConfirm(msg.actionId!, "/api/assistant/action/confirm")}>Confirm & Create</Button>
                            <Button onClick={handleClose}>Cancel</Button>
                          </InlineStack>
                        </div>
                      )}

                      {msg.type === "requires_input" && msg.actionId && (
                        <div style={{ marginTop: '12px' }}>
                          {msg.inputType === "options" && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {msg.data?.options?.map((opt: string) => (
                                <Button key={opt} onClick={() => handleSend(undefined, opt)}>{opt}</Button>
                              ))}
                              <Button onClick={handleClose}>Cancel</Button>
                            </div>
                          )}
                          {msg.inputType === "product_picker" && (
                            <InlineStack gap="300">
                              <Button tone="success" onClick={() => handleSelectProducts(msg.actionId!, msg.data)}>Select Products</Button>
                              <Button onClick={handleClose}>Cancel</Button>
                            </InlineStack>
                          )}
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div style={{ flexShrink: 0, padding: '6px', backgroundColor: '#e3f2fd', borderRadius: '50%' }}>
                        <Icon source={PersonIcon} tone="info" />
                      </div>
                    )}

                  </div>
                ))}

                {fetcher.state === "submitting" && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ padding: '8px' }}>
                      <Spinner size="small" />
                    </div>
                  </div>
                )}
              </div>

              <Divider />

              {/* Input Area */}
              <div style={{ padding: '16px', backgroundColor: '#ffffff' }}>
                <form onSubmit={handleSend} style={{ display: "flex", alignItems: "center", backgroundColor: "#f4f6f8", borderRadius: "24px", padding: "4px 8px" }}>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`Ask ${activeModule.title} Assistant...`}
                    style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: "15px", backgroundColor: "transparent", color: "#202223" }}
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || fetcher.state === "submitting"}
                    style={{
                      backgroundColor: inputValue.trim() ? "#005bd3" : "transparent",
                      border: "none",
                      borderRadius: "50%",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: inputValue.trim() ? "pointer" : "default",
                      color: inputValue.trim() ? "#ffffff" : "#8c9196"
                    }}
                  >
                    <Icon source={ArrowUpIcon} tone={inputValue.trim() ? "base" : "subdued"} />
                  </button>
                </form>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
