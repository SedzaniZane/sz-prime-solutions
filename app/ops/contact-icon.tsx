import { phoneIcon, whatsappIcon } from "@/lib/contact-icons";

export default function ContactIcon({ kind }: { kind: "phone" | "whatsapp" }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke={kind === "whatsapp" ? "#137a52" : "currentColor"}
    strokeWidth="1.6" strokeLinejoin="round" style={{ verticalAlign: "text-bottom", marginRight: 5 }}>
    <path d={kind === "whatsapp" ? whatsappIcon : phoneIcon} />
  </svg>;
}
