"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Loader2, Star, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listMessages, type MessageAnswer, type MessageQuestion } from "@/lib/api/messages";

export default function MessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("inbox");
  const [read, setRead] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["messages", id, read],
    queryFn: () => listMessages(id, read),
  });

  const messages = data ?? [];

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex rounded-xl border border-input p-0.5">
        {[
          { key: false, label: t("newTab") },
          { key: true, label: t("oldTab") },
        ].map((tab) => (
          <button
            key={String(tab.key)}
            type="button"
            onClick={() => setRead(tab.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              read === tab.key ? "bg-foreground text-white" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <Mail className="size-12 opacity-40" />
          <p>{t("empty")}</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {messages.map((m, i) => (
            <MessageCard key={m._id} message={m} index={i + 1} submissionLabel={t("submission")} />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageCard({
  message,
  index,
  submissionLabel,
}: {
  message: MessageAnswer;
  index: number;
  submissionLabel: string;
}) {
  const locale = useLocale();
  const date = message.createdAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(message.createdAt),
      )
    : "";

  return (
    <div className="rounded-2xl bg-card p-4 shadow-[0_3px_12px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          #{index}
        </span>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      <div className="divide-y divide-border">
        {(message.info.questions ?? []).map((q, qi) => (
          <div key={qi} className="py-3 first:pt-0 last:pb-0">
            <p className="text-sm font-medium text-foreground">
              {q.data.question}
              {q.data.required && <span className="text-error"> *</span>}
            </p>
            <div className="mt-1.5">
              <AnswerView q={q} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnswerView({ q }: { q: MessageQuestion }) {
  if (q.type === "rating") {
    const n = Number(q.answer) || 0;
    const total = q.data.stars_number ?? 5;
    return (
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <Star
            key={i}
            className={`size-4 ${i < n ? "fill-warning text-warning" : "text-border"}`}
          />
        ))}
      </div>
    );
  }
  if (q.type === "choices") {
    const choices = Array.isArray(q.answer) ? q.answer : [q.answer].filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1.5">
        {choices.map((c, i) => (
          <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {String(c)}
          </span>
        ))}
      </div>
    );
  }
  const text = q.answer == null ? "" : String(q.answer);
  return (
    <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
      {text || "—"}
    </p>
  );
}
