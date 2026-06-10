import type { User, BookingRequest, CalendarBlock, Specialization, CompanyReview, NotificationLog } from './types';

// Helper: Get array of YYYY-MM-DD date strings in range (inclusive)
export function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [];
  }
  
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Initial seed data
const SEED_USERS: User[] = [
  {
    id: 'c1',
    name: 'WedLuxe Productions',
    email: 'info@wedluxe.com',
    role: 'Company',
    rating: 4.8,
    reviewsCount: 3,
    companyBadges: ['💳 Fast Pay', '📋 Precise Brief', '🍽️ Premium Lodging']
  },
  {
    id: 'f1',
    name: 'Amit Sharma',
    email: 'amit.sharma@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://behance.net/amitsharma', 'https://instagram.com/amitsharmaphotos'],
    location: 'Delhi',
    specialization: 'Photographer',
    bio: 'Award-winning traditional and candid photographer with 8+ years of experience shooting luxury Indian weddings.',
    ratePerDay: 5000,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
  },
  {
    id: 'f2',
    name: 'Priya Patel',
    email: 'priya.patel@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://priyaphotography.cargo.site', 'https://instagram.com/priya_candid'],
    location: 'Mumbai',
    specialization: 'Candid',
    bio: 'Specialist in capturing raw emotions, laughs, and tears. I focus on natural lighting and documentary-style photography.',
    ratePerDay: 8000,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
  },
  {
    id: 'f3',
    name: 'Rajesh Kumar',
    email: 'rajesh.films@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://vimeo.com/rajeshkumarfilms'],
    location: 'Delhi',
    specialization: 'Cinematographer',
    bio: 'Creating cinematic wedding films that tell a story. Expertise in gimbal operations, lighting, and aerial drone cinematography.',
    ratePerDay: 8000,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
  },
  {
    id: 'f4',
    name: 'Sneha Sen',
    email: 'snehasen@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://snehasenfilms.myportfolio.com'],
    location: 'Goa',
    specialization: 'Videographer',
    bio: 'Goa-based destination wedding videographer. I capture high-energy dance sequences, kirtans, and intimate beach ceremonies.',
    ratePerDay: 5000,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  },
  {
    id: 'f5',
    name: 'Vikram Singh',
    email: 'vikram.singh@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://flickr.com/vikramsinghwedding'],
    location: 'Jaipur',
    specialization: 'Photographer',
    bio: 'Specializing in royal palace weddings. Capturing the grandeur, colors, and heritage of Rajasthan weddings.',
    ratePerDay: 5000,
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'
  },
  {
    id: 'f6',
    name: 'Rahul Mehta',
    email: 'rahul.mehta@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://vimeo.com/rahulmehtafilms', 'https://instagram.com/rahulmehta_wedding'],
    location: 'Mumbai',
    specialization: 'Cinematographer',
    bio: 'Director of photography specializing in grand scale weddings, multi-camera setups, and high-production-value edits.',
    ratePerDay: 8000,
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
  },
  {
    id: 'f7',
    name: 'Neha Gupta',
    email: 'neha.gupta@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://behance.net/nehaguptaweddings'],
    location: 'Delhi',
    specialization: 'Candid',
    bio: 'Candid wedding specialist with a background in fashion photography. Focused on modern editorial aesthetic and style.',
    ratePerDay: 8000,
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
  },
  {
    id: 'f8',
    name: 'Arjun Rao',
    email: 'arjun.rao@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://vimeo.com/arjunfilms'],
    location: 'Delhi',
    specialization: 'Videographer',
    bio: 'Capturing the color, spirit, and raw emotions of Indian wedding events through professional high-speed video capture.',
    ratePerDay: 5000,
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150'
  },
  {
    id: 'f9',
    name: 'Pooja Shah',
    email: 'pooja.shah@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://poojashah.photography'],
    location: 'Mumbai',
    specialization: 'Photographer',
    bio: 'Capturing stunning portraits and grand decor details. Combining classic lighting with photojournalism.',
    ratePerDay: 5000,
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'
  },
  {
    id: 'f10',
    name: 'Rohan Deshmukh',
    email: 'rohan.desh@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://instagram.com/rohan_candid_goa'],
    location: 'Goa',
    specialization: 'Candid',
    bio: 'Goa beach wedding expert. Specializing in sunset light candids, cocktail party vibes, and emotional close-ups.',
    ratePerDay: 8000,
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'
  },
  {
    id: 'f11',
    name: 'Anjali Sharma',
    email: 'anjali.films@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://vimeo.com/anjalisharma'],
    location: 'Mumbai',
    specialization: 'Videographer',
    bio: 'Documentary style wedding videography. Capturing the organic rhythm of ceremonies and family dynamics.',
    ratePerDay: 5000,
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150'
  },
  {
    id: 'f12',
    name: 'Kabir Verma',
    email: 'kabir.verma@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://kabirverma.myportfolio.com'],
    location: 'Goa',
    specialization: 'Cinematographer',
    bio: 'High-end drone pilot and cinematographer. Creating grand cinematic trailers and destination wedding highlights.',
    ratePerDay: 8000,
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'
  },
  {
    id: 'f13',
    name: 'Meera Joshi',
    email: 'meera.joshi@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://flickr.com/meerajoshiwedding'],
    location: 'Goa',
    specialization: 'Photographer',
    bio: 'Destination beach wedding specialist. Focusing on pre-wedding preps, bridal details, and sunset pheras.',
    ratePerDay: 5000,
    avatarUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=150'
  },
  {
    id: 'f14',
    name: 'Dev Karan',
    email: 'dev.karan@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://devkaranfilms.in'],
    location: 'Jaipur',
    specialization: 'Cinematographer',
    bio: 'Palace wedding cinematographer based in Jaipur. Capturing heritage architecture and royal wedding aesthetics.',
    ratePerDay: 8000,
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150'
  },
  {
    id: 'f15',
    name: 'Shweta Tiwari',
    email: 'shweta.tiwari@gmail.com',
    role: 'Freelancer',
    portfolioLinks: ['https://shwetatiwariphoto.com'],
    location: 'Jaipur',
    specialization: 'Candid',
    bio: 'Emotional candid wedding specialist. Warm tones, real laughter, and capture of the royal Rajasthani heritage vibe.',
    ratePerDay: 8000,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'
  }
];

// Generate 12 more demo profiles for each location (Delhi, Mumbai, Goa, Jaipur)
const locations = ['Delhi', 'Mumbai', 'Goa', 'Jaipur'];
const specializations: Specialization[] = ['Photographer', 'Videographer', 'Cinematographer', 'Candid'];

const firstNamesPool = [
  'Aarav', 'Ananya', 'Ishaan', 'Diya', 'Vihaan', 'Kiara', 'Reyansh', 'Myra', 'Arjun', 'Riya',
  'Aryan', 'Saisha', 'Abeer', 'Anika', 'Vivaan', 'Prisha', 'Dev', 'Meera', 'Rohan', 'Sneha',
  'Aditya', 'Priya', 'Rajesh', 'Neha', 'Vikram', 'Pooja', 'Rahul', 'Anjali', 'Sanjay', 'Shweta',
  'Amit', 'Sunita', 'Gaurav', 'Kavita', 'Abhishek', 'Ritu', 'Karan', 'Tanvi', 'Deepak', 'Isha',
  'Vijay', 'Divya', 'Suresh', 'Swati', 'Kunal', 'Kriti', 'Harsh', 'Nisha'
];

const lastNamesPool = [
  'Sharma', 'Patel', 'Kumar', 'Singh', 'Sen', 'Gupta', 'Mehta', 'Rao', 'Shah', 'Deshmukh',
  'Joshi', 'Verma', 'Karan', 'Tiwari', 'Bose', 'Chatterjee', 'Roy', 'Mukherjee', 'Das', 'Dutta',
  'Nair', 'Pillai', 'Menon', 'Iyer', 'Iyengar', 'Reddy', 'Choudhury', 'Mishra', 'Pandey', 'Dubey',
  'Tripathi', 'Shukla', 'Yadav', 'Prasad', 'Jha', 'Sinha', 'Chawla', 'Kapoor', 'Khanna', 'Malhotra',
  'Mehra', 'Sari', 'Gill', 'Dhillon', 'Sidhu', 'Sandhu', 'Grewal'
];

const bioTemplates: Record<Specialization, string[]> = {
  Photographer: [
    'Specialist in traditional wedding photography and portraiture with an eye for detailed rituals.',
    'Capturing timeless wedding moments, heritage ceremonies, and beautiful family portraits.',
    'Experienced commercial and traditional wedding photographer with an elegant artistic style.'
  ],
  Videographer: [
    'High-definition wedding videographer capturing high-energy dances, events, and rituals.',
    'Documenting wedding celebrations with dynamic gimbal work, clear sound, and crisp highlights.',
    'Professional videographer specialized in fast-paced multi-camera coverage and highlight films.'
  ],
  Cinematographer: [
    'Cinematographer crafting beautiful storytelling wedding films with high production value.',
    'Expert in aerial drone footage, creative lighting, and cinematic slow-motion highlights.',
    'Creating cinematic masterpieces with a documentary style and artistic composition.'
  ],
  Candid: [
    'Candid photography specialist capturing raw emotions, spontaneous laughter, and tears.',
    'Documentary-style candid photographer focused on natural light and emotional storytelling.',
    'Capturing the authentic and unscripted emotions of your destination wedding celebration.'
  ]
};

const avatarUrls = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'
];

let freelancerIdCounter = 16;
for (const loc of locations) {
  for (let i = 0; i < 12; i++) {
    const spec = specializations[i % specializations.length];
    const rate = (spec === 'Photographer' || spec === 'Videographer') ? 5000 : 8000;
    
    // Select name deterministically based on location and index
    const nameIndex = (loc.charCodeAt(0) + loc.charCodeAt(loc.length - 1) + i) % firstNamesPool.length;
    const lastNameIndex = (loc.charCodeAt(1) + i * 3) % lastNamesPool.length;
    const name = `${firstNamesPool[nameIndex]} ${lastNamesPool[lastNameIndex]}`;
    const email = `${firstNamesPool[nameIndex].toLowerCase()}.${lastNamesPool[lastNameIndex].toLowerCase()}${i}@wedmatch.com`;
    
    const bioList = bioTemplates[spec];
    const bio = bioList[i % bioList.length];
    const avatar = avatarUrls[(nameIndex + lastNameIndex) % avatarUrls.length];
    
    SEED_USERS.push({
      id: `f${freelancerIdCounter++}`,
      name,
      email,
      role: 'Freelancer',
      portfolioLinks: [
        `https://instagram.com/${firstNamesPool[nameIndex].toLowerCase()}_visuals`,
        `https://behance.net/${firstNamesPool[nameIndex].toLowerCase()}${lastNamesPool[lastNameIndex].toLowerCase()}`
      ],
      location: loc,
      specialization: spec,
      bio,
      ratePerDay: rate,
      avatarUrl: avatar
    });
  }
}

// Seed initial offline blocks for demonstration
const SEED_BLOCKS: CalendarBlock[] = [
  // Amit Sharma blocked offline on next week
  {
    id: 'b1',
    freelancerId: 'f1',
    date: '2026-06-12',
    type: 'Offline',
    label: 'Family Function'
  },
  {
    id: 'b2',
    freelancerId: 'f1',
    date: '2026-06-13',
    type: 'Offline',
    label: 'Local Shoot'
  },
  // Priya Patel has a booking on June 17 (Wedding date)
  {
    id: 'b3',
    freelancerId: 'f2',
    date: '2026-06-17',
    type: 'Booking',
    requestId: 'req_seed_1',
    companyName: 'WedLuxe Productions'
  },
  // Amit Sharma booked June 25
  {
    id: 'b4',
    freelancerId: 'f1',
    date: '2026-06-25',
    type: 'Booking',
    requestId: 'req_seed_2_a',
    companyName: 'WedLuxe Productions'
  },
  {
    id: 'b5',
    freelancerId: 'f1',
    date: '2026-06-25',
    type: 'Booking',
    requestId: 'req_seed_2_b',
    companyName: 'WedLuxe Productions'
  },
  // Sneha Sen booked June 25
  {
    id: 'b6',
    freelancerId: 'f4',
    date: '2026-06-25',
    type: 'Booking',
    requestId: 'req_seed_3_a',
    companyName: 'WedLuxe Productions'
  },
  {
    id: 'b7',
    freelancerId: 'f4',
    date: '2026-06-25',
    type: 'Booking',
    requestId: 'req_seed_3_b',
    companyName: 'WedLuxe Productions'
  }
];

// Seed Company Reviews
const SEED_REVIEWS: CompanyReview[] = [
  {
    id: 'r1',
    companyId: 'c1',
    freelancerName: 'Sneha Sen',
    rating: 5,
    text: 'Always pays on time, usually within 24 hours of project completion. The crew travel and stay arrangements are top-tier.',
    date: '2026-05-10'
  },
  {
    id: 'r2',
    companyId: 'c1',
    freelancerName: 'Amit Sharma',
    rating: 5,
    text: 'Great experience shooting a destination wedding in Udaipur with WedLuxe. Very clear schedule grids and zero micromanagement.',
    date: '2026-05-24'
  },
  {
    id: 'r3',
    companyId: 'c1',
    freelancerName: 'Priya Patel',
    rating: 4,
    text: 'Highly professional. The briefs were incredibly detailed. Payment cleared after a small invoicing delay, but overall an excellent partner.',
    date: '2026-06-02'
  }
];

const SEED_REQUESTS: BookingRequest[] = [
  {
    id: 'req_seed_1',
    companyId: 'c1',
    companyName: 'WedLuxe Productions',
    freelancerId: 'f2',
    freelancerName: 'Priya Patel',
    freelancerSpecialization: 'Candid',
    projectName: 'Kapoor Palace Wedding',
    details: 'Shoot wedding events.',
    budget: 8000,
    startDate: '2026-06-17',
    endDate: '2026-06-17',
    status: 'Confirmed',
    createdAt: '2026-06-01T10:00:00.000Z',
    expiresAt: '2026-06-04T10:00:00.000Z',
    shootId: 'shoot1_3',
    slotId: 'slot1_3_c'
  },
  {
    id: 'req_seed_2_a',
    companyId: 'c1',
    companyName: 'WedLuxe Productions',
    freelancerId: 'f1',
    freelancerName: 'Amit Sharma',
    freelancerSpecialization: 'Photographer',
    projectName: 'Malhotra & Sen Destination Wedding',
    details: 'Traditional and portrait coverage.',
    budget: 2500,
    startDate: '2026-06-25',
    endDate: '2026-06-25',
    status: 'Confirmed',
    createdAt: '2026-06-03T11:00:00.000Z',
    expiresAt: '2026-06-06T11:00:00.000Z',
    shootId: 'shoot2_2',
    slotId: 'slot2_2_p',
    groupId: 'group_seed_2'
  },
  {
    id: 'req_seed_2_b',
    companyId: 'c1',
    companyName: 'WedLuxe Productions',
    freelancerId: 'f1',
    freelancerName: 'Amit Sharma',
    freelancerSpecialization: 'Photographer',
    projectName: 'Malhotra & Sen Destination Wedding',
    details: 'Traditional and portrait coverage.',
    budget: 2500,
    startDate: '2026-06-25',
    endDate: '2026-06-25',
    status: 'Confirmed',
    createdAt: '2026-06-03T11:00:00.000Z',
    expiresAt: '2026-06-06T11:00:00.000Z',
    shootId: 'shoot2_3',
    slotId: 'slot2_3_p',
    groupId: 'group_seed_2'
  },
  {
    id: 'req_seed_3_a',
    companyId: 'c1',
    companyName: 'WedLuxe Productions',
    freelancerId: 'f4',
    freelancerName: 'Sneha Sen',
    freelancerSpecialization: 'Videographer',
    projectName: 'Malhotra & Sen Destination Wedding',
    details: 'Cinematic video highlight.',
    budget: 2500,
    startDate: '2026-06-25',
    endDate: '2026-06-25',
    status: 'Confirmed',
    createdAt: '2026-06-03T11:00:00.000Z',
    expiresAt: '2026-06-06T11:00:00.000Z',
    shootId: 'shoot2_2',
    slotId: 'slot2_2_v',
    groupId: 'group_seed_3'
  },
  {
    id: 'req_seed_3_b',
    companyId: 'c1',
    companyName: 'WedLuxe Productions',
    freelancerId: 'f4',
    freelancerName: 'Sneha Sen',
    freelancerSpecialization: 'Videographer',
    projectName: 'Malhotra & Sen Destination Wedding',
    details: 'Cinematic video highlight.',
    budget: 2500,
    startDate: '2026-06-25',
    endDate: '2026-06-25',
    status: 'Confirmed',
    createdAt: '2026-06-03T11:00:00.000Z',
    expiresAt: '2026-06-06T11:00:00.000Z',
    shootId: 'shoot2_3',
    slotId: 'slot2_3_v',
    groupId: 'group_seed_3'
  }
];

import type { Project, ShootSchedule, Deliverable, DeliverableStatus } from './types';

const SEED_PROJECTS: Project[] = [
  {
    id: 'proj1',
    companyId: 'c1',
    name: 'Kapoor Palace Wedding',
    clientName: 'Anil Kapoor',
    clientPhone: '+91 98123 45678',
    status: 'Active',
    billingAmount: 200000,
    extraExpenses: 5000,
    createdAt: '2026-06-01T10:00:00.000Z'
  },
  {
    id: 'proj2',
    companyId: 'c1',
    name: 'Malhotra & Sen Destination Wedding',
    clientName: 'Sanjay Malhotra',
    clientPhone: '+91 99999 88888',
    status: 'Active',
    billingAmount: 200000,
    extraExpenses: 5000,
    createdAt: '2026-06-03T11:00:00.000Z'
  }
];

const SEED_SHOOTS: ShootSchedule[] = [
  // Kapoor Palace Wedding (proj1)
  {
    id: 'shoot1_1',
    projectId: 'proj1',
    title: 'Mehendi',
    date: '2026-06-16',
    time: '16:00',
    venue: 'Udaipur Palace',
    crewSlots: [
      { id: 'slot1_1_p', role: 'Photographer', allocatedFreelancerId: null },
      { id: 'slot1_1_v', role: 'Videographer', allocatedFreelancerId: null }
    ]
  },
  {
    id: 'shoot1_2',
    projectId: 'proj1',
    title: 'Haldi',
    date: '2026-06-17',
    time: '10:00',
    venue: 'Udaipur Palace',
    crewSlots: [
      { id: 'slot1_2_p', role: 'Photographer', allocatedFreelancerId: null },
      { id: 'slot1_2_v', role: 'Videographer', allocatedFreelancerId: null }
    ]
  },
  {
    id: 'shoot1_3',
    projectId: 'proj1',
    title: 'Wedding',
    date: '2026-06-17',
    time: '18:00',
    venue: 'Udaipur Palace',
    crewSlots: [
      { id: 'slot1_3_p', role: 'Photographer', allocatedFreelancerId: null },
      { id: 'slot1_3_v', role: 'Videographer', allocatedFreelancerId: null },
      { id: 'slot1_3_c', role: 'Candid', allocatedFreelancerId: 'f2' }
    ]
  },
  // Malhotra & Sen Destination Wedding (proj2)
  {
    id: 'shoot2_1',
    projectId: 'proj2',
    title: 'Mehendi',
    date: '2026-06-24',
    time: '16:00',
    venue: 'Grand Hyatt Goa',
    crewSlots: [
      { id: 'slot2_1_p', role: 'Photographer', allocatedFreelancerId: null },
      { id: 'slot2_1_v', role: 'Videographer', allocatedFreelancerId: null }
    ]
  },
  {
    id: 'shoot2_2',
    projectId: 'proj2',
    title: 'Haldi',
    date: '2026-06-25',
    time: '10:00',
    venue: 'Grand Hyatt Goa',
    crewSlots: [
      { id: 'slot2_2_p', role: 'Photographer', allocatedFreelancerId: 'f1' },
      { id: 'slot2_2_v', role: 'Videographer', allocatedFreelancerId: 'f4' }
    ]
  },
  {
    id: 'shoot2_3',
    projectId: 'proj2',
    title: 'Wedding',
    date: '2026-06-25',
    time: '18:00',
    venue: 'Grand Hyatt Goa',
    crewSlots: [
      { id: 'slot2_3_p', role: 'Photographer', allocatedFreelancerId: 'f1' },
      { id: 'slot2_3_v', role: 'Videographer', allocatedFreelancerId: 'f4' }
    ]
  }
];

const SEED_DELIVERABLES: Deliverable[] = [
  {
    id: 'deliv1',
    projectId: 'proj1',
    name: 'Premium Album (12x18)',
    packageType: 'Included',
    deadline: '2026-07-20',
    status: 'Pending',
    cost: 10000
  },
  {
    id: 'deliv2',
    projectId: 'proj2',
    name: '30-min Cinematic Film',
    packageType: 'Included',
    deadline: '2026-07-25',
    status: 'In Progress',
    cost: 7000
  },
  {
    id: 'deliv3',
    projectId: 'proj2',
    name: 'Instagram Reels Bundle (5 Reels)',
    packageType: 'Addon',
    deadline: '2026-07-15',
    status: 'Delivered',
    cost: 1500
  }
];

const STORAGE_KEYS = {
  USERS: 'wedmatch_users',
  REQUESTS: 'wedmatch_requests',
  BLOCKS: 'wedmatch_blocks',
  SIMULATED_TIME: 'wedmatch_simulated_time',
  REVIEWS: 'wedmatch_reviews',
  NOTIFICATIONS: 'wedmatch_notifications',
  PROJECTS: 'wedmatch_projects',
  SHOOTS: 'wedmatch_shoots',
  DELIVERABLES: 'wedmatch_deliverables'
};

export function initDatabase(): void {
  const DB_VERSION = 'v4_deliverables_cost';
  const currentVersion = localStorage.getItem('wedmatch_db_version');

  if (currentVersion !== DB_VERSION) {
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.REQUESTS);
    localStorage.removeItem(STORAGE_KEYS.BLOCKS);
    localStorage.removeItem(STORAGE_KEYS.REVIEWS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.SHOOTS);
    localStorage.removeItem(STORAGE_KEYS.DELIVERABLES);
    localStorage.setItem('wedmatch_db_version', DB_VERSION);
  }

  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.REQUESTS)) {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(SEED_REQUESTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.BLOCKS)) {
    localStorage.setItem(STORAGE_KEYS.BLOCKS, JSON.stringify(SEED_BLOCKS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.REVIEWS)) {
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(SEED_REVIEWS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SIMULATED_TIME)) {
    localStorage.setItem(STORAGE_KEYS.SIMULATED_TIME, new Date('2026-06-05T09:00:00').toISOString());
  }
  if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(SEED_PROJECTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SHOOTS)) {
    localStorage.setItem(STORAGE_KEYS.SHOOTS, JSON.stringify(SEED_SHOOTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.DELIVERABLES)) {
    localStorage.setItem(STORAGE_KEYS.DELIVERABLES, JSON.stringify(SEED_DELIVERABLES));
  }
}

// Reset data
export function resetDatabase(): void {
  localStorage.setItem('wedmatch_db_version', 'v4_deliverables_cost');
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(SEED_REQUESTS));
  localStorage.setItem(STORAGE_KEYS.BLOCKS, JSON.stringify(SEED_BLOCKS));
  localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(SEED_REVIEWS));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SIMULATED_TIME, new Date('2026-06-05T09:00:00').toISOString());
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(SEED_PROJECTS));
  localStorage.setItem(STORAGE_KEYS.SHOOTS, JSON.stringify(SEED_SHOOTS));
  localStorage.setItem(STORAGE_KEYS.DELIVERABLES, JSON.stringify(SEED_DELIVERABLES));
  
  // Clear requirements keys
  const keys = Object.keys(localStorage);
  keys.forEach(k => {
    if (k.startsWith('wedmatch_req_limits_')) {
      localStorage.removeItem(k);
    }
  });
}


// Simulated Time travel
export function getSimulatedTime(): Date {
  const timeStr = localStorage.getItem(STORAGE_KEYS.SIMULATED_TIME);
  return timeStr ? new Date(timeStr) : new Date('2026-06-05T09:00:00');
}

export function saveSimulatedTime(date: Date): void {
  localStorage.setItem(STORAGE_KEYS.SIMULATED_TIME, date.toISOString());
}

// User operations
export function getUsers(): User[] {
  initDatabase();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
}

export function getFreelancers(): User[] {
  return getUsers().filter(u => u.role === 'Freelancer');
}

export function updateFreelancerProfile(id: string, updates: Partial<User>): void {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }
}

// Booking Request operations
export function getBookingRequests(): BookingRequest[] {
  initDatabase();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
}

export function saveBookingRequests(requests: BookingRequest[]): void {
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
}

// Crew Requirements Management
export function getAllSpecializationRequirements(companyId: string): Record<Specialization, number> {
  initDatabase();
  const requirements = localStorage.getItem(`wedmatch_req_limits_${companyId}`);
  const defaultLimits: Record<Specialization, number> = {
    Photographer: 1,
    Videographer: 1,
    Cinematographer: 1,
    Candid: 1
  };
  if (!requirements) return defaultLimits;
  return { ...defaultLimits, ...JSON.parse(requirements) };
}

export function setSpecializationRequirement(companyId: string, specialization: Specialization, limit: number): void {
  initDatabase();
  const requirements = localStorage.getItem(`wedmatch_req_limits_${companyId}`);
  const parsed = requirements ? JSON.parse(requirements) : {};
  parsed[specialization] = limit;
  localStorage.setItem(`wedmatch_req_limits_${companyId}`, JSON.stringify(parsed));
}

export function isSpecializationLocked(companyId: string, specialization: Specialization): boolean {
  const activeRequests = getCompanyActiveRequests(companyId).filter(r => r.freelancerSpecialization === specialization);
  return activeRequests.length >= 1;
}

// Exclusivity checked per specialization
export function hasActiveRequestForSpecialization(companyId: string, specialization: Specialization): boolean {
  return isSpecializationLocked(companyId, specialization);
}

// Slot-level exclusivity locking helpers
export function getSlotActiveRequest(slotId: string): BookingRequest | undefined {
  const requests = getBookingRequests();
  return requests.find(r => r.slotId === slotId && r.status === 'Pending');
}

export function isSlotLocked(slotId: string): boolean {
  return getSlotActiveRequest(slotId) !== undefined;
}

export function getCompanyActiveRequests(companyId: string): BookingRequest[] {
  const requests = getBookingRequests();
  return requests.filter(r => r.companyId === companyId && r.status === 'Pending');
}

// Deprecated in favor of per-specialization check, but kept for compatibility
export function hasActiveRequest(companyId: string): boolean {
  const requests = getBookingRequests();
  return requests.some(r => r.companyId === companyId && r.status === 'Pending');
}

// Calendar Block operations
export function getCalendarBlocks(): CalendarBlock[] {
  initDatabase();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.BLOCKS) || '[]');
}

export function saveCalendarBlocks(blocks: CalendarBlock[]): void {
  localStorage.setItem(STORAGE_KEYS.BLOCKS, JSON.stringify(blocks));
}

// Toggle manual block (extended to accept labels)
export function toggleManualBlock(freelancerId: string, dateStr: string, label?: string): void {
  const blocks = getCalendarBlocks();
  const blockIdx = blocks.findIndex(b => b.freelancerId === freelancerId && b.date === dateStr);
  
  if (blockIdx !== -1) {
    if (blocks[blockIdx].type === 'Offline') {
      blocks.splice(blockIdx, 1);
    }
  } else {
    blocks.push({
      id: Math.random().toString(36).substring(2, 9),
      freelancerId,
      date: dateStr,
      type: 'Offline',
      label: label || 'Busy (Offline)'
    });
  }
  saveCalendarBlocks(blocks);
}

// Company Reviews operations
export function getCompanyReviews(companyId: string): CompanyReview[] {
  initDatabase();
  const allReviews: CompanyReview[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.REVIEWS) || '[]');
  return allReviews.filter(r => r.companyId === companyId);
}

export function addCompanyReview(companyId: string, freelancerName: string, rating: number, text: string): void {
  initDatabase();
  const reviews: CompanyReview[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.REVIEWS) || '[]');
  
  const newReview: CompanyReview = {
    id: Math.random().toString(36).substring(2, 9),
    companyId,
    freelancerName,
    rating,
    text,
    date: getSimulatedTime().toISOString().split('T')[0]
  };
  
  reviews.push(newReview);
  localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));

  // Recalculate average rating and reviews count on Company profile
  const users = getUsers();
  const companyIdx = users.findIndex(u => u.id === companyId);
  if (companyIdx !== -1) {
    const companyReviews = reviews.filter(r => r.companyId === companyId);
    const totalRating = companyReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = parseFloat((totalRating / companyReviews.length).toFixed(1));
    
    users[companyIdx].rating = avgRating;
    users[companyIdx].reviewsCount = companyReviews.length;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }
}

// Notification Logs operations
export function getNotificationLogs(): NotificationLog[] {
  initDatabase();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
}

export function addNotificationLog(params: { recipientName: string; type: 'WhatsApp' | 'Email'; message: string }): void {
  const logs = getNotificationLogs();
  const newLog: NotificationLog = {
    id: Math.random().toString(36).substring(2, 9),
    recipientName: params.recipientName,
    type: params.type,
    message: params.message,
    timestamp: getSimulatedTime().toISOString()
  };
  logs.unshift(newLog); // Newest logs first
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(logs));
}

// Main booking workflow
export function sendBookingRequest(params: {
  companyId: string;
  companyName: string;
  freelancerId: string;
  freelancerName: string;
  projectName: string;
  details: string;
  budget: number;
  startDate: string;
  endDate: string;
  shootId: string;
  slotId: string;
}): BookingRequest {
  // Find freelancer's specialization
  const freelancers = getFreelancers();
  const freelancer = freelancers.find(f => f.id === params.freelancerId);
  const freelancerSpecialization = freelancer?.specialization || 'Photographer';

  if (isSlotLocked(params.slotId)) {
    throw new Error(`Exclusive Booking Policy: This crew requirement slot already has an active pending request. You must withdraw it or wait for it to expire/be declined before requesting other crew for this slot.`);
  }

  const simulatedNow = getSimulatedTime();
  const expiresAt = new Date(simulatedNow);
  expiresAt.setDate(expiresAt.getDate() + 3); // 3 days expiration

  const newRequest: BookingRequest = {
    id: Math.random().toString(36).substring(2, 9),
    companyId: params.companyId,
    companyName: params.companyName,
    freelancerId: params.freelancerId,
    freelancerName: params.freelancerName,
    freelancerSpecialization,
    projectName: params.projectName,
    details: params.details,
    budget: params.budget,
    startDate: params.startDate,
    endDate: params.endDate,
    status: 'Pending',
    createdAt: simulatedNow.toISOString(),
    expiresAt: expiresAt.toISOString(),
    shootId: params.shootId,
    slotId: params.slotId
  };

  const requests = getBookingRequests();
  requests.push(newRequest);
  saveBookingRequests(requests);

  // Trigger simulated notifications
  const waMsg = `Hello ${params.freelancerName}, WedLuxe Productions has invited you for project '${params.projectName}' (${params.startDate} to ${params.endDate}) offering a budget of ₹${params.budget.toLocaleString()}. Log in to Accept/Decline within 3 days.`;
  const emailMsg = `Booking Invitation Details: Project: ${params.projectName}. Dates: ${params.startDate} to ${params.endDate}. Daily Budget Offer: ₹${params.budget.toLocaleString()}. Total Brief: ${params.details.substring(0, 100)}...`;

  addNotificationLog({
    recipientName: params.freelancerName,
    type: 'WhatsApp',
    message: `💬 WhatsApp API dispatched: "${waMsg}"`
  });

  addNotificationLog({
    recipientName: params.freelancerName,
    type: 'Email',
    message: `✉️ Email Alert sent to freelancer inbox: "${emailMsg}"`
  });

  // Dispatch custom browser event so App.tsx can show a Toast Alert in real-time
  const toastEvent = new CustomEvent('wedmatch-notification', { 
    detail: { 
      freelancerName: params.freelancerName,
      message: `💬 WhatsApp API dispatched to ${params.freelancerName}!`
    } 
  });
  window.dispatchEvent(toastEvent);
  
  return newRequest;
}

export function sendProjectBookingRequests(params: {
  companyId: string;
  companyName: string;
  freelancerId: string;
  freelancerName: string;
  projectName: string;
  details: string;
  dailyBudget: number;
  slots: { shootId: string; slotId: string; date: string; title: string }[];
}): BookingRequest[] {
  // Find freelancer's specialization
  const freelancers = getFreelancers();
  const freelancer = freelancers.find(f => f.id === params.freelancerId);
  const freelancerSpecialization = freelancer?.specialization || 'Photographer';

  // Check if any slot is locked
  for (const slot of params.slots) {
    if (isSlotLocked(slot.slotId)) {
      throw new Error(`Exclusive Booking Policy: Slot for ${slot.title} already has an active pending request.`);
    }
  }

  const simulatedNow = getSimulatedTime();
  const expiresAt = new Date(simulatedNow);
  expiresAt.setDate(expiresAt.getDate() + 3); // 3 days expiration

  const groupId = 'group_' + Math.random().toString(36).substring(2, 9);
  const requests: BookingRequest[] = [];

  // Count how many slots are on each unique date
  const dateCounts: Record<string, number> = {};
  params.slots.forEach(slot => {
    dateCounts[slot.date] = (dateCounts[slot.date] || 0) + 1;
  });

  const uniqueDates = Array.from(new Set(params.slots.map(s => s.date)));
  const totalBudget = params.dailyBudget * uniqueDates.length;

  for (const slot of params.slots) {
    const slotsOnThisDate = dateCounts[slot.date];
    const slotBudget = params.dailyBudget / slotsOnThisDate; // Split daily rate among shoots on the same day

    const newRequest: BookingRequest = {
      id: Math.random().toString(36).substring(2, 9),
      companyId: params.companyId,
      companyName: params.companyName,
      freelancerId: params.freelancerId,
      freelancerName: params.freelancerName,
      freelancerSpecialization,
      projectName: params.projectName,
      details: params.details,
      budget: slotBudget,
      startDate: slot.date,
      endDate: slot.date,
      status: 'Pending',
      createdAt: simulatedNow.toISOString(),
      expiresAt: expiresAt.toISOString(),
      shootId: slot.shootId,
      slotId: slot.slotId,
      groupId: groupId
    };
    requests.push(newRequest);
  }

  const allRequests = getBookingRequests();
  allRequests.push(...requests);
  saveBookingRequests(allRequests);

  // Trigger simulated notifications covering all functions
  const functionsList = params.slots.map(s => `${s.title} (${s.date})`).join(', ');
  const waMsg = `Hello ${params.freelancerName}, ${params.companyName} has invited you for project '${params.projectName}' covering: ${functionsList}. Daily Rate: ₹${params.dailyBudget.toLocaleString()} (Total offer: ₹${totalBudget.toLocaleString()}). Log in to Accept/Decline within 3 days.`;
  const emailMsg = `Booking Invitation Details: Project: ${params.projectName}. Events: ${functionsList}. Daily Budget Offer: ₹${params.dailyBudget.toLocaleString()}. Brief: ${params.details}`;

  addNotificationLog({
    recipientName: params.freelancerName,
    type: 'WhatsApp',
    message: `💬 WhatsApp API dispatched: "${waMsg}"`
  });

  addNotificationLog({
    recipientName: params.freelancerName,
    type: 'Email',
    message: `✉️ Email Alert sent to freelancer inbox: "${emailMsg}"`
  });

  // Dispatch custom browser event so App.tsx can show a Toast Alert in real-time
  const toastEvent = new CustomEvent('wedmatch-notification', { 
    detail: { 
      freelancerName: params.freelancerName,
      message: `💬 WhatsApp API dispatched to ${params.freelancerName}!`
    } 
  });
  window.dispatchEvent(toastEvent);
  
  return requests;
}

export function acceptBookingRequest(requestId: string): void {
  const requests = getBookingRequests();
  const reqIdx = requests.findIndex(r => r.id === requestId);
  
  if (reqIdx === -1) return;
  const targetReq = requests[reqIdx];
  if (targetReq.status !== 'Pending') return;

  const groupRequests = targetReq.groupId
    ? requests.filter(r => r.groupId === targetReq.groupId && r.status === 'Pending')
    : [targetReq];
  
  // Update status to Confirmed for all requests in the group
  groupRequests.forEach(req => {
    req.status = 'Confirmed';
    // Auto-allocate freelancer to the shoot schedule slot
    allocateFreelancer(req.shootId, req.slotId, req.freelancerId);

    // Auto-block the dates on freelancer's calendar
    const blocks = getCalendarBlocks();
    const dates = getDatesInRange(req.startDate, req.endDate);
    
    dates.forEach(date => {
      // Clean up offline block if it was there (Booking overrides offline)
      const existingIdx = blocks.findIndex(b => b.freelancerId === req.freelancerId && b.date === date);
      if (existingIdx !== -1) {
        if (blocks[existingIdx].type === 'Offline') {
          blocks.splice(existingIdx, 1);
        } else {
          return;
        }
      }
      
      blocks.push({
        id: Math.random().toString(36).substring(2, 9),
        freelancerId: req.freelancerId,
        date,
        type: 'Booking',
        requestId: req.id,
        companyName: req.companyName
      });
    });
    
    saveCalendarBlocks(blocks);
  });

  saveBookingRequests(requests);

  // Notify Company of acceptance
  const functionsList = groupRequests.map(r => r.startDate).join(', ');
  addNotificationLog({
    recipientName: targetReq.companyName,
    type: 'WhatsApp',
    message: `💬 WhatsApp Alert sent to ${targetReq.companyName}: "Good news! ${targetReq.freelancerName} has ACCEPTED your booking request for '${targetReq.projectName}' on dates: ${functionsList}."`
  });
}

export function declineBookingRequest(requestId: string): void {
  const requests = getBookingRequests();
  const reqIdx = requests.findIndex(r => r.id === requestId);
  
  if (reqIdx === -1) return;
  const targetReq = requests[reqIdx];
  if (targetReq.status !== 'Pending') return;
  
  const groupRequests = targetReq.groupId
    ? requests.filter(r => r.groupId === targetReq.groupId && r.status === 'Pending')
    : [targetReq];

  groupRequests.forEach(req => {
    req.status = 'Declined';
  });

  saveBookingRequests(requests);

  // Notify Company of decline
  addNotificationLog({
    recipientName: targetReq.companyName,
    type: 'WhatsApp',
    message: `💬 WhatsApp Alert sent to ${targetReq.companyName}: "${targetReq.freelancerName} has DECLINED your booking request for '${targetReq.projectName}'."`
  });
}

export function cancelBookingRequest(requestId: string): void {
  const requests = getBookingRequests();
  const reqIdx = requests.findIndex(r => r.id === requestId);
  
  if (reqIdx === -1) return;
  const targetReq = requests[reqIdx];
  if (targetReq.status !== 'Pending') return;
  
  const groupRequests = targetReq.groupId
    ? requests.filter(r => r.groupId === targetReq.groupId && r.status === 'Pending')
    : [targetReq];

  groupRequests.forEach(req => {
    req.status = 'Cancelled';
  });

  saveBookingRequests(requests);

  // Notify freelancer of manual company withdrawal
  addNotificationLog({
    recipientName: targetReq.freelancerName,
    type: 'WhatsApp',
    message: `💬 WhatsApp Alert sent to ${targetReq.freelancerName}: "Booking request for '${targetReq.projectName}' has been manually withdrawn/cancelled by ${targetReq.companyName}."`
  });
}


// Background Cron-like check to expire requests
export function checkExpiration(simulatedNow: Date): boolean {
  const requests = getBookingRequests();
  let changed = false;
  
  requests.forEach(req => {
    if (req.status === 'Pending') {
      const expirationDate = new Date(req.expiresAt);
      if (simulatedNow >= expirationDate) {
        req.status = 'Expired';
        changed = true;

        // Log notification of expiration
        addNotificationLog({
          recipientName: req.companyName,
          type: 'WhatsApp',
          message: `⏳ WhatsApp Expiration Alert sent to ${req.companyName}: "Booking request for '${req.projectName}' sent to ${req.freelancerName} has EXPIRED after 3 days with no response. You can now request other creators."`
        });
      }
    }
  });
  
  if (changed) {
    saveBookingRequests(requests);
  }
  
  return changed;
}

// Availability Search engine
export function getAvailableFreelancers(filters: {
  startDate?: string;
  endDate?: string;
  location?: string;
  specialization?: Specialization;
}): User[] {
  let freelancers = getFreelancers();
  
  if (filters.location) {
    const locLower = filters.location.toLowerCase();
    freelancers = freelancers.filter(f => f.location && f.location.toLowerCase().includes(locLower));
  }
  
  if (filters.specialization) {
    freelancers = freelancers.filter(f => f.specialization === filters.specialization);
  }
  
  if (filters.startDate && filters.endDate) {
    const targetDates = getDatesInRange(filters.startDate, filters.endDate);
    if (targetDates.length > 0) {
      const blocks = getCalendarBlocks();
      
      freelancers = freelancers.filter(f => {
        const freelancerBlocks = blocks.filter(b => b.freelancerId === f.id);
        const hasConflict = targetDates.some(date => 
          freelancerBlocks.some(b => b.date === date)
        );
        return !hasConflict;
      });
    }
  }
  
  return freelancers;
}

export function getProjects(): Project[] {
  initDatabase();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
}

export function getShootSchedules(): ShootSchedule[] {
  initDatabase();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOOTS) || '[]');
}

export function saveShootSchedules(shoots: ShootSchedule[]): void {
  localStorage.setItem(STORAGE_KEYS.SHOOTS, JSON.stringify(shoots));
}

export function getDeliverables(): Deliverable[] {
  initDatabase();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.DELIVERABLES) || '[]');
}

export function saveDeliverables(deliverables: Deliverable[]): void {
  localStorage.setItem(STORAGE_KEYS.DELIVERABLES, JSON.stringify(deliverables));
}

export function createProject(params: {
  companyId: string;
  name: string;
  clientName: string;
  clientPhone: string;
  billingAmount: number;
  extraExpenses: number;
  shoots: {
    title: string;
    date: string;
    time: string;
    venue: string;
    crewSlots: { role: Specialization; allocatedFreelancerId: string | null }[];
  }[];
  deliverables: Omit<Deliverable, 'id' | 'projectId' | 'status'>[];
}): Project {
  const projectId = 'proj_' + Math.random().toString(36).substring(2, 9);
  
  const newProject: Project = {
    id: projectId,
    companyId: params.companyId,
    name: params.name,
    clientName: params.clientName,
    clientPhone: params.clientPhone,
    status: 'Active',
    billingAmount: params.billingAmount,
    extraExpenses: params.extraExpenses,
    createdAt: new Date().toISOString()
  };

  const projects = getProjects();
  projects.push(newProject);
  saveProjects(projects);

  const shoots = getShootSchedules();
  params.shoots.forEach(s => {
    const shootId = 'shoot_' + Math.random().toString(36).substring(2, 9);
    const slotsWithIds = s.crewSlots.map(slot => ({
      id: 'slot_' + Math.random().toString(36).substring(2, 9),
      role: slot.role,
      allocatedFreelancerId: slot.allocatedFreelancerId
    }));

    shoots.push({
      id: shootId,
      projectId,
      title: s.title,
      date: s.date,
      time: s.time,
      venue: s.venue,
      crewSlots: slotsWithIds
    });
  });
  saveShootSchedules(shoots);

  const delivs = getDeliverables();
  params.deliverables.forEach(d => {
    delivs.push({
      ...d,
      id: 'deliv_' + Math.random().toString(36).substring(2, 9),
      projectId,
      status: 'Pending'
    });
  });
  saveDeliverables(delivs);

  return newProject;
}

export function updateProject(projectId: string, params: {
  name: string;
  clientName: string;
  clientPhone: string;
  billingAmount: number;
  extraExpenses: number;
  shoots: {
    id?: string;
    title: string;
    date: string;
    time: string;
    venue: string;
    crewSlots: { id?: string; role: Specialization; allocatedFreelancerId: string | null }[];
  }[];
  deliverables: {
    id?: string;
    name: string;
    packageType: 'Included' | 'Addon';
    deadline: string;
    status?: DeliverableStatus;
    cost: number;
  }[];
}): void {
  // 1. Update Project
  const projects = getProjects();
  const projIdx = projects.findIndex(p => p.id === projectId);
  if (projIdx !== -1) {
    projects[projIdx] = {
      ...projects[projIdx],
      name: params.name,
      clientName: params.clientName,
      clientPhone: params.clientPhone,
      billingAmount: params.billingAmount,
      extraExpenses: params.extraExpenses
    };
    saveProjects(projects);
  }

  // 2. Update Shoots
  const allShoots = getShootSchedules();
  const otherShoots = allShoots.filter(s => s.projectId !== projectId);
  const currentProjectShoots = allShoots.filter(s => s.projectId === projectId);
  const updatedShoots: ShootSchedule[] = [];

  const bookingRequests = getBookingRequests();
  let requestsChanged = false;

  params.shoots.forEach(incomingShoot => {
    let shootId = incomingShoot.id;
    let existingShoot = currentProjectShoots.find(s => s.id === shootId);
    
    if (!shootId || !existingShoot) {
      shootId = 'shoot_' + Math.random().toString(36).substring(2, 9);
    }

    const slotsWithIds = incomingShoot.crewSlots.map(incomingSlot => {
      let slotId = incomingSlot.id;
      let existingSlot = existingShoot ? (existingShoot.crewSlots || []).find(sl => sl.id === slotId) : null;
      
      if (!slotId || !existingSlot) {
        slotId = 'slot_' + Math.random().toString(36).substring(2, 9);
      }

      return {
        id: slotId,
        role: incomingSlot.role,
        allocatedFreelancerId: existingSlot ? existingSlot.allocatedFreelancerId : null
      };
    });

    updatedShoots.push({
      id: shootId,
      projectId,
      title: incomingShoot.title,
      date: incomingShoot.date,
      time: incomingShoot.time,
      venue: incomingShoot.venue,
      crewSlots: slotsWithIds
    });
  });

  // Cancel pending requests for deleted shoots/slots
  currentProjectShoots.forEach(oldShoot => {
    const stillExists = updatedShoots.find(s => s.id === oldShoot.id);
    if (!stillExists) {
      (oldShoot.crewSlots || []).forEach(oldSlot => {
        bookingRequests.forEach(req => {
          if (req.slotId === oldSlot.id && req.status === 'Pending') {
            req.status = 'Cancelled';
            requestsChanged = true;
          }
        });
      });
    } else {
      (oldShoot.crewSlots || []).forEach(oldSlot => {
        const slotStillExists = stillExists.crewSlots.find(sl => sl.id === oldSlot.id);
        if (!slotStillExists) {
          bookingRequests.forEach(req => {
            if (req.slotId === oldSlot.id && req.status === 'Pending') {
              req.status = 'Cancelled';
              requestsChanged = true;
            }
          });
        }
      });
    }
  });

  if (requestsChanged) {
    localStorage.setItem('wedmatch_requests', JSON.stringify(bookingRequests));
  }

  saveShootSchedules([...otherShoots, ...updatedShoots]);

  // 3. Update Deliverables
  const allDelivs = getDeliverables();
  const otherDelivs = allDelivs.filter(d => d.projectId !== projectId);
  const currentProjectDelivs = allDelivs.filter(d => d.projectId === projectId);
  const updatedDelivs: Deliverable[] = [];

  params.deliverables.forEach(incomingDeliv => {
    let delivId = incomingDeliv.id;
    let existingDeliv = currentProjectDelivs.find(d => d.id === delivId);
    
    if (!delivId || !existingDeliv) {
      delivId = 'deliv_' + Math.random().toString(36).substring(2, 9);
    }

    updatedDelivs.push({
      id: delivId,
      projectId,
      name: incomingDeliv.name,
      packageType: incomingDeliv.packageType,
      deadline: incomingDeliv.deadline,
      status: existingDeliv ? existingDeliv.status : 'Pending',
      cost: incomingDeliv.cost
    });
  });

  saveDeliverables([...otherDelivs, ...updatedDelivs]);
}

export function allocateFreelancer(shootId: string, slotId: string, freelancerId: string | null): void {
  const shoots = getShootSchedules();
  const shootIdx = shoots.findIndex(s => s.id === shootId);
  if (shootIdx !== -1) {
    const crewSlots = shoots[shootIdx].crewSlots || [];
    const slotIdx = crewSlots.findIndex(slot => slot.id === slotId);
    if (slotIdx !== -1) {
      crewSlots[slotIdx].allocatedFreelancerId = freelancerId;
      saveShootSchedules(shoots);
    }
  }
}

export function getFreelancerAllocations(freelancerId: string): (ShootSchedule & { projectName: string; clientName: string; clientPhone: string; roleNeeded: Specialization; slotId: string })[] {
  const allShoots = getShootSchedules();
  const projects = getProjects();
  const allocations: (ShootSchedule & { projectName: string; clientName: string; clientPhone: string; roleNeeded: Specialization; slotId: string })[] = [];
  
  allShoots.forEach(s => {
    const crewSlots = s.crewSlots || [];
    crewSlots.forEach(slot => {
      if (slot.allocatedFreelancerId === freelancerId) {
        const proj = projects.find(p => p.id === s.projectId) || { name: 'Unknown Project', clientName: 'Unknown', clientPhone: '' };
        allocations.push({
          ...s,
          projectName: proj.name,
          clientName: proj.clientName,
          clientPhone: proj.clientPhone,
          roleNeeded: slot.role,
          slotId: slot.id
        });
      }
    });
  });
  
  return allocations;
}

