export type UserRole = 'Company' | 'Freelancer';

export type Specialization = 'Photographer' | 'Videographer' | 'Cinematographer' | 'Candid';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  // Freelancer specific fields
  portfolioLinks?: string[];
  location?: string;
  specialization?: Specialization;
  bio?: string;
  ratePerDay?: number;
  avatarUrl?: string;
  // Company trust specific fields
  rating?: number;
  reviewsCount?: number;
  companyBadges?: string[];
}

export interface CompanyReview {
  id: string;
  companyId: string;
  freelancerName: string;
  rating: number;
  text: string;
  date: string; // YYYY-MM-DD
}

export interface NotificationLog {
  id: string;
  recipientName: string;
  type: 'WhatsApp' | 'Email';
  message: string;
  timestamp: string; // ISO String
}

export type BookingStatus = 'Pending' | 'Confirmed' | 'Declined' | 'Expired' | 'Cancelled';

export interface BookingRequest {
  id: string;
  companyId: string;
  companyName: string;
  freelancerId: string;
  freelancerName: string;
  freelancerSpecialization: Specialization;
  projectName: string;
  details: string;
  budget: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: BookingStatus;
  createdAt: string; // ISO String
  expiresAt: string; // ISO String (createdAt + 3 days)
  shootId: string;   // Associated shoot ID
  slotId: string;    // Associated crew slot ID
  groupId?: string;  // Group ID for multi-shoot requests
}

export type CalendarBlockType = 'Offline' | 'Booking';

export interface CalendarBlock {
  id: string;
  freelancerId: string;
  date: string; // YYYY-MM-DD
  type: CalendarBlockType;
  requestId?: string; // Associated booking request ID
  companyName?: string; // Cache company name for quick display
  label?: string; // Custom label for manual blocks (e.g., "WhatsApp Booking", "Vacation")
}

export type ProjectStatus = 'Enquiry' | 'Active' | 'Completed' | 'Archived';
export type DeliverableStatus = 'Pending' | 'In Progress' | 'Review' | 'Delivered';

export interface Project {
  id: string;
  companyId: string;
  name: string;
  clientName: string;
  clientPhone: string;
  status: ProjectStatus;
  billingAmount: number;
  extraExpenses: number;
  createdAt: string;
}

export interface CrewSlot {
  id: string;
  role: Specialization;
  allocatedFreelancerId: string | null;
}

export interface ShootSchedule {
  id: string;
  projectId: string;
  title: string;       // e.g. "Haldi", "Reception"
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  venue: string;
  crewSlots: CrewSlot[];
}

export interface Deliverable {
  id: string;
  projectId: string;
  name: string;
  packageType: 'Included' | 'Addon';
  deadline: string;    // YYYY-MM-DD
  status: DeliverableStatus;
  cost: number;
}

