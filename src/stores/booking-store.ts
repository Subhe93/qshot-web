import { create } from "zustand";
import type { Customer, Provider, Service } from "@/lib/api/booking";

export type BookingSection =
  | "home"
  | "bookings"
  | "customers"
  | "providers"
  | "services"
  | "analytics"
  | "config";

export type BookingDetail =
  | { type: "none" }
  | { type: "booking"; ref: string }
  | { type: "customer"; id: string }
  | { type: "provider"; data: Provider | null } // null = create
  | { type: "service"; data: Service | null };

interface BookingUiState {
  section: BookingSection;
  detail: BookingDetail;
  selectSection: (s: BookingSection) => void;
  selectBooking: (ref: string) => void;
  selectCustomer: (c: Customer) => void;
  selectProvider: (p: Provider | null) => void;
  selectService: (s: Service | null) => void;
  clearDetail: () => void;
}

export const useBookingUi = create<BookingUiState>((set) => ({
  section: "home",
  detail: { type: "none" },
  selectSection: (section) => set({ section, detail: { type: "none" } }),
  selectBooking: (ref) => set({ detail: { type: "booking", ref } }),
  selectCustomer: (c) =>
    set({ detail: { type: "customer", id: c._id ?? c.id ?? "" } }),
  selectProvider: (p) => set({ detail: { type: "provider", data: p } }),
  selectService: (s) => set({ detail: { type: "service", data: s } }),
  clearDetail: () => set({ detail: { type: "none" } }),
}));
