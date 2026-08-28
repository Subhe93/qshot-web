"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getContact } from "@/lib/api/contacts";
import { ContactEditor } from "@/components/contacts/contact-editor";

export default function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const contactQ = useQuery({
    queryKey: ["contact", id],
    queryFn: () => getContact(id),
  });
  if (!contactQ.data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <ContactEditor contact={contactQ.data} />;
}
