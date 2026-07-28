--
-- PostgreSQL database dump
--


-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: BusinessModule; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BusinessModule" AS ENUM (
    'LAUNDRY',
    'FNB',
    'SALON',
    'CLEANING'
);


--
-- Name: ClockType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ClockType" AS ENUM (
    'CLOCK_IN',
    'CLOCK_OUT'
);


--
-- Name: CommissionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CommissionType" AS ENUM (
    'NONE',
    'FLAT',
    'PERCENTAGE'
);


--
-- Name: DepositTransactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DepositTransactionType" AS ENUM (
    'TOP_UP',
    'DEDUCTION',
    'REFUND',
    'ADJUSTMENT'
);


--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'RECEIVED',
    'IN_PROGRESS',
    'READY',
    'DELIVERED',
    'CANCELED'
);


--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'TRANSFER',
    'QRIS',
    'DEPOSIT'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID',
    'REFUNDED'
);


--
-- Name: PickupRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PickupRequestStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'SCHEDULED',
    'CONVERTED',
    'REJECTED',
    'CANCELED'
);


--
-- Name: PlanTier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlanTier" AS ENUM (
    'FREE',
    'GROWTH',
    'PRO'
);


--
-- Name: PricingType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PricingType" AS ENUM (
    'PER_KG',
    'PER_ITEM',
    'FLAT'
);


--
-- Name: PromoType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PromoType" AS ENUM (
    'FREE_MONTH',
    'DISCOUNT_PERCENT',
    'DISCOUNT_FIXED'
);


--
-- Name: SaaSPaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SaaSPaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);


--
-- Name: StockMovementType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockMovementType" AS ENUM (
    'IN',
    'OUT',
    'ADJUSTMENT'
);


--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'TRIAL',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED',
    'EXPIRED'
);


--
-- Name: SuperAdminRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SuperAdminRole" AS ENUM (
    'SUPER_ADMIN',
    'SUPPORT'
);


--
-- Name: SupportTicketCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupportTicketCategory" AS ENUM (
    'BILLING',
    'TECHNICAL',
    'ACCOUNT',
    'OTHER'
);


--
-- Name: SupportTicketPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupportTicketPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
);


--
-- Name: SupportTicketStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupportTicketStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'OWNER',
    'MANAGER',
    'EMPLOYEE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    action text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text NOT NULL,
    "tenantId" text,
    "actorId" text NOT NULL,
    "actorEmail" text NOT NULL,
    reason text,
    diff jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BlogPost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BlogPost" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    keywords text,
    content text NOT NULL,
    "coverImage" text,
    published boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "authorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Branch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Branch" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    "invoiceFooter" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "tenantId" text NOT NULL,
    latitude double precision,
    longitude double precision,
    "operatingHours" jsonb,
    "whatsappLink" text,
    "googleMapsLink" text,
    "printerHost" text,
    "printerPort" integer DEFAULT 9100 NOT NULL,
    "printerName" text,
    "printerEnabled" boolean DEFAULT false NOT NULL,
    "printerLastSeen" timestamp(3) without time zone,
    "printerPaperSize" text DEFAULT '58mm'::text NOT NULL,
    "coverageEnd" timestamp(3) without time zone,
    "isFreeTier" boolean DEFAULT false NOT NULL,
    slug text,
    "pickupSlots" jsonb,
    "workDays" integer[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ClockEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClockEvent" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    "branchId" text NOT NULL,
    type public."ClockType" NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Customer" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    notes text,
    balance numeric(12,2) DEFAULT 0 NOT NULL,
    "branchId" text NOT NULL,
    "clientId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DepositTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DepositTransaction" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "customerId" text NOT NULL,
    "branchId" text NOT NULL,
    type public."DepositTransactionType" NOT NULL,
    amount numeric(12,2) NOT NULL,
    "balanceAfter" numeric(12,2) NOT NULL,
    "orderId" text,
    description text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ErrorLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ErrorLog" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "requestId" text NOT NULL,
    method text NOT NULL,
    url text NOT NULL,
    "httpStatus" integer NOT NULL,
    code text NOT NULL,
    message text NOT NULL,
    stack text,
    "tenantId" text,
    "userId" text,
    "ipAddress" text,
    "userAgent" text,
    resolved boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Expense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Expense" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "branchId" text NOT NULL,
    "categoryId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ExpenseCategory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExpenseCategory" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    description text,
    "branchId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: FeatureFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeatureFlag" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "orderNumber" text NOT NULL,
    "customerId" text NOT NULL,
    status public."OrderStatus" DEFAULT 'RECEIVED'::public."OrderStatus" NOT NULL,
    "totalAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "discountAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "discountType" text,
    "paidAmount" numeric(12,2) DEFAULT 0 NOT NULL,
    "paymentStatus" public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    notes text,
    module public."BusinessModule" DEFAULT 'LAUNDRY'::public."BusinessModule" NOT NULL,
    "branchId" text NOT NULL,
    "clientId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "receivedAt" timestamp(3) without time zone,
    "inProgressAt" timestamp(3) without time zone,
    "readyAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone
);


--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderItem" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "orderId" text NOT NULL,
    "serviceId" text NOT NULL,
    quantity numeric(10,3) NOT NULL,
    "weightKg" numeric(10,2),
    "pricePerUnit" numeric(10,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    notes text,
    "garmentBreakdown" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: OrderPhoto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderPhoto" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "tenantId" text NOT NULL,
    "orderId" text NOT NULL,
    "branchId" text,
    kind text NOT NULL,
    "storagePath" text NOT NULL,
    bytes integer NOT NULL,
    width integer,
    height integer,
    mime text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "orderId" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    "paymentMethod" public."PaymentMethod" NOT NULL,
    notes text,
    "paidAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PickupRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PickupRequest" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "tenantId" text NOT NULL,
    "branchId" text NOT NULL,
    module public."BusinessModule" DEFAULT 'LAUNDRY'::public."BusinessModule" NOT NULL,
    "customerName" text NOT NULL,
    "customerPhone" text NOT NULL,
    "customerEmail" text,
    "customerId" text,
    latitude double precision,
    longitude double precision,
    "addressText" text,
    "mapsLink" text,
    "requestedDate" timestamp(3) without time zone,
    "requestedSlot" text,
    status public."PickupRequestStatus" DEFAULT 'PENDING'::public."PickupRequestStatus" NOT NULL,
    notes text,
    "assignedDriverId" text,
    "convertedOrderId" text,
    "convertedAt" timestamp(3) without time zone,
    "rejectedReason" text,
    "rejectedAt" timestamp(3) without time zone,
    "rejectedById" text,
    "acceptedAt" timestamp(3) without time zone,
    "acceptedById" text,
    "scheduledAt" timestamp(3) without time zone,
    "scheduledById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Plan" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    description text,
    "maxOutlets" integer DEFAULT 1 NOT NULL,
    "maxUsers" integer DEFAULT 2 NOT NULL,
    "maxOrders" integer DEFAULT 100 NOT NULL,
    "priceMonthly" numeric(12,2) DEFAULT 0 NOT NULL,
    "priceYearly" numeric(12,2) DEFAULT 0 NOT NULL,
    modules text[] DEFAULT ARRAY[]::text[],
    features jsonb,
    "isActive" boolean DEFAULT true NOT NULL,
    tier public."PlanTier",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PromoCode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PromoCode" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    code text NOT NULL,
    description text,
    type public."PromoType" NOT NULL,
    value numeric(12,2) NOT NULL,
    "maxRedemptions" integer,
    "redemptionCount" integer DEFAULT 0 NOT NULL,
    "validFrom" timestamp(3) without time zone,
    "validUntil" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "applicablePlan" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PromoRedemption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PromoRedemption" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "promoCodeId" text NOT NULL,
    "tenantId" text NOT NULL,
    "appliedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Referral; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Referral" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "referrerId" text NOT NULL,
    "referredId" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "rewardMonths" integer DEFAULT 1 NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rewardedAt" timestamp(3) without time zone
);


--
-- Name: Role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Role" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    permissions text[] DEFAULT ARRAY[]::text[],
    color text DEFAULT 'purple'::text NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SaaSPayment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SaaSPayment" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "tenantId" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    "outletCount" integer NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    "monthsPurchased" integer DEFAULT 1 NOT NULL,
    "promoCodeId" text,
    "midtransOrderId" text,
    "midtransSnapToken" text,
    status public."SaaSPaymentStatus" DEFAULT 'PENDING'::public."SaaSPaymentStatus" NOT NULL,
    kind text DEFAULT 'RENEWAL'::text NOT NULL,
    "proratedDays" integer,
    "coverageStart" timestamp(3) without time zone,
    "coverageEnd" timestamp(3) without time zone,
    "branchIds" text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "paidAt" timestamp(3) without time zone
);


--
-- Name: Service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Service" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    description text,
    "pricingType" public."PricingType" NOT NULL,
    "basePrice" numeric(10,2) NOT NULL,
    "commissionType" public."CommissionType" DEFAULT 'NONE'::public."CommissionType" NOT NULL,
    "commissionValue" numeric(12,2) DEFAULT 0 NOT NULL,
    module public."BusinessModule" DEFAULT 'LAUNDRY'::public."BusinessModule" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isDefaultSpeed" boolean DEFAULT false NOT NULL,
    "branchId" text NOT NULL,
    "groupId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ServiceGroup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ServiceGroup" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    description text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    module public."BusinessModule" DEFAULT 'LAUNDRY'::public."BusinessModule" NOT NULL,
    "branchId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StockItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockItem" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    "currentQuantity" numeric(12,3) DEFAULT 0 NOT NULL,
    "lowStockThreshold" numeric(12,3) DEFAULT 0 NOT NULL,
    "purchasePricePerUnit" numeric(12,2) DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "branchId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StockMovement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockMovement" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "stockItemId" text NOT NULL,
    type public."StockMovementType" NOT NULL,
    quantity numeric(12,3) NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "tenantId" text NOT NULL,
    "planId" text NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'TRIAL'::public."SubscriptionStatus" NOT NULL,
    "currentPeriodEnd" timestamp(3) without time zone,
    "paidOutletCount" integer DEFAULT 0 NOT NULL,
    "currentPeriodStart" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SuperAdmin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SuperAdmin" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    role public."SuperAdminRole" DEFAULT 'SUPER_ADMIN'::public."SuperAdminRole" NOT NULL,
    "sessionVersion" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportTicket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportTicket" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    subject text NOT NULL,
    description text NOT NULL,
    category public."SupportTicketCategory" DEFAULT 'OTHER'::public."SupportTicketCategory" NOT NULL,
    priority public."SupportTicketPriority" DEFAULT 'NORMAL'::public."SupportTicketPriority" NOT NULL,
    status public."SupportTicketStatus" DEFAULT 'OPEN'::public."SupportTicketStatus" NOT NULL,
    "tenantId" text,
    "submitterName" text NOT NULL,
    "submitterEmail" text NOT NULL,
    "submitterPhone" text,
    "submittedById" text,
    "ipAddress" text,
    "userAgent" text,
    "csatRating" integer,
    "csatComment" text,
    "csatAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone
);


--
-- Name: SystemSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemSetting" (
    key text NOT NULL,
    value text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TelemetryEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TelemetryEvent" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "tenantId" text,
    "userId" text,
    kind text NOT NULL,
    payload jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tenant" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "ownerEmail" text NOT NULL,
    "ownerName" text,
    "ownerPhone" text,
    "logoUrl" text,
    "customDomain" text,
    "activeModules" text[] DEFAULT ARRAY['laundry'::text],
    settings jsonb,
    "isActive" boolean DEFAULT true NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "onboardingCompletedAt" timestamp(3) without time zone,
    "isDemo" boolean DEFAULT false NOT NULL,
    "demoExpiresAt" timestamp(3) without time zone,
    "trialEndsAt" timestamp(3) without time zone,
    "trialTier" text,
    "websiteEnabled" boolean DEFAULT false NOT NULL,
    "websitePublishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "referralCode" text
);


--
-- Name: TenantFeatureFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantFeatureFlag" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "flagId" text NOT NULL,
    "tenantId" text NOT NULL,
    enabled boolean NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TicketComment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TicketComment" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "ticketId" text NOT NULL,
    "authorName" text NOT NULL,
    "authorEmail" text NOT NULL,
    "authorRole" text NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    phone text,
    "googleId" text,
    "emailVerified" timestamp(3) without time zone,
    "lastLoginAt" timestamp(3) without time zone,
    avatar text,
    role public."UserRole" DEFAULT 'EMPLOYEE'::public."UserRole" NOT NULL,
    "roleId" text,
    "tenantId" text NOT NULL,
    "branchId" text,
    "sessionVersion" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastTicketEventReadAt" timestamp(3) without time zone,
    "pinHash" text,
    "qrToken" text
);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BlogPost BlogPost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlogPost"
    ADD CONSTRAINT "BlogPost_pkey" PRIMARY KEY (id);


--
-- Name: Branch Branch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_pkey" PRIMARY KEY (id);


--
-- Name: ClockEvent ClockEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClockEvent"
    ADD CONSTRAINT "ClockEvent_pkey" PRIMARY KEY (id);


--
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);


--
-- Name: DepositTransaction DepositTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepositTransaction"
    ADD CONSTRAINT "DepositTransaction_pkey" PRIMARY KEY (id);


--
-- Name: ErrorLog ErrorLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ErrorLog"
    ADD CONSTRAINT "ErrorLog_pkey" PRIMARY KEY (id);


--
-- Name: ExpenseCategory ExpenseCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY (id);


--
-- Name: Expense Expense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_pkey" PRIMARY KEY (id);


--
-- Name: FeatureFlag FeatureFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureFlag"
    ADD CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: OrderPhoto OrderPhoto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderPhoto"
    ADD CONSTRAINT "OrderPhoto_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PickupRequest PickupRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PickupRequest"
    ADD CONSTRAINT "PickupRequest_pkey" PRIMARY KEY (id);


--
-- Name: Plan Plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Plan"
    ADD CONSTRAINT "Plan_pkey" PRIMARY KEY (id);


--
-- Name: PromoCode PromoCode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoCode"
    ADD CONSTRAINT "PromoCode_pkey" PRIMARY KEY (id);


--
-- Name: PromoRedemption PromoRedemption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoRedemption"
    ADD CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY (id);


--
-- Name: Referral Referral_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Referral"
    ADD CONSTRAINT "Referral_pkey" PRIMARY KEY (id);


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: SaaSPayment SaaSPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaaSPayment"
    ADD CONSTRAINT "SaaSPayment_pkey" PRIMARY KEY (id);


--
-- Name: ServiceGroup ServiceGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceGroup"
    ADD CONSTRAINT "ServiceGroup_pkey" PRIMARY KEY (id);


--
-- Name: Service Service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_pkey" PRIMARY KEY (id);


--
-- Name: StockItem StockItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockItem"
    ADD CONSTRAINT "StockItem_pkey" PRIMARY KEY (id);


--
-- Name: StockMovement StockMovement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: SuperAdmin SuperAdmin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SuperAdmin"
    ADD CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicket SupportTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY (id);


--
-- Name: SystemSetting SystemSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemSetting"
    ADD CONSTRAINT "SystemSetting_pkey" PRIMARY KEY (key);


--
-- Name: TelemetryEvent TelemetryEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TelemetryEvent"
    ADD CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY (id);


--
-- Name: TenantFeatureFlag TenantFeatureFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantFeatureFlag"
    ADD CONSTRAINT "TenantFeatureFlag_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: TicketComment TicketComment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketComment"
    ADD CONSTRAINT "TicketComment_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_actorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_actorId_idx" ON public."AuditLog" USING btree ("actorId");


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_targetType_targetId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_targetType_targetId_idx" ON public."AuditLog" USING btree ("targetType", "targetId");


--
-- Name: AuditLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_tenantId_idx" ON public."AuditLog" USING btree ("tenantId");


--
-- Name: BlogPost_published_publishedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BlogPost_published_publishedAt_idx" ON public."BlogPost" USING btree (published, "publishedAt");


--
-- Name: BlogPost_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BlogPost_slug_key" ON public."BlogPost" USING btree (slug);


--
-- Name: Branch_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Branch_isActive_idx" ON public."Branch" USING btree ("isActive");


--
-- Name: Branch_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Branch_slug_key" ON public."Branch" USING btree (slug);


--
-- Name: Branch_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Branch_tenantId_idx" ON public."Branch" USING btree ("tenantId");


--
-- Name: Branch_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Branch_tenantId_name_key" ON public."Branch" USING btree ("tenantId", name);


--
-- Name: ClockEvent_tenantId_branchId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ClockEvent_tenantId_branchId_timestamp_idx" ON public."ClockEvent" USING btree ("tenantId", "branchId", "timestamp");


--
-- Name: ClockEvent_userId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ClockEvent_userId_timestamp_idx" ON public."ClockEvent" USING btree ("userId", "timestamp");


--
-- Name: Customer_branchId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_branchId_createdAt_idx" ON public."Customer" USING btree ("branchId", "createdAt");


--
-- Name: Customer_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_branchId_idx" ON public."Customer" USING btree ("branchId");


--
-- Name: Customer_branchId_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Customer_branchId_phone_key" ON public."Customer" USING btree ("branchId", phone);


--
-- Name: DepositTransaction_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepositTransaction_branchId_idx" ON public."DepositTransaction" USING btree ("branchId");


--
-- Name: DepositTransaction_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DepositTransaction_customerId_idx" ON public."DepositTransaction" USING btree ("customerId");


--
-- Name: ErrorLog_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ErrorLog_code_idx" ON public."ErrorLog" USING btree (code);


--
-- Name: ErrorLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ErrorLog_createdAt_idx" ON public."ErrorLog" USING btree ("createdAt");


--
-- Name: ErrorLog_httpStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ErrorLog_httpStatus_idx" ON public."ErrorLog" USING btree ("httpStatus");


--
-- Name: ErrorLog_resolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ErrorLog_resolved_idx" ON public."ErrorLog" USING btree (resolved);


--
-- Name: ErrorLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ErrorLog_tenantId_idx" ON public."ErrorLog" USING btree ("tenantId");


--
-- Name: ExpenseCategory_branchId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ExpenseCategory_branchId_name_key" ON public."ExpenseCategory" USING btree ("branchId", name);


--
-- Name: Expense_branchId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_branchId_date_idx" ON public."Expense" USING btree ("branchId", date);


--
-- Name: Expense_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_branchId_idx" ON public."Expense" USING btree ("branchId");


--
-- Name: Expense_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_date_idx" ON public."Expense" USING btree (date);


--
-- Name: FeatureFlag_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureFlag_category_idx" ON public."FeatureFlag" USING btree (category);


--
-- Name: FeatureFlag_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureFlag_enabled_idx" ON public."FeatureFlag" USING btree (enabled);


--
-- Name: FeatureFlag_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FeatureFlag_key_key" ON public."FeatureFlag" USING btree (key);


--
-- Name: OrderItem_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");


--
-- Name: OrderItem_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderItem_serviceId_idx" ON public."OrderItem" USING btree ("serviceId");


--
-- Name: OrderPhoto_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderPhoto_orderId_idx" ON public."OrderPhoto" USING btree ("orderId");


--
-- Name: OrderPhoto_tenantId_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderPhoto_tenantId_expiresAt_idx" ON public."OrderPhoto" USING btree ("tenantId", "expiresAt");


--
-- Name: Order_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_branchId_idx" ON public."Order" USING btree ("branchId");


--
-- Name: Order_branchId_module_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_branchId_module_receivedAt_idx" ON public."Order" USING btree ("branchId", module, "receivedAt");


--
-- Name: Order_branchId_module_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_branchId_module_status_idx" ON public."Order" USING btree ("branchId", module, status);


--
-- Name: Order_clientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_clientId_key" ON public."Order" USING btree ("clientId");


--
-- Name: Order_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_createdAt_idx" ON public."Order" USING btree ("createdAt");


--
-- Name: Order_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_customerId_idx" ON public."Order" USING btree ("customerId");


--
-- Name: Order_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_module_idx" ON public."Order" USING btree (module);


--
-- Name: Order_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_orderNumber_key" ON public."Order" USING btree ("orderNumber");


--
-- Name: Order_paymentStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_paymentStatus_idx" ON public."Order" USING btree ("paymentStatus");


--
-- Name: Order_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);


--
-- Name: Payment_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_orderId_idx" ON public."Payment" USING btree ("orderId");


--
-- Name: Payment_paidAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_paidAt_idx" ON public."Payment" USING btree ("paidAt");


--
-- Name: PickupRequest_branchId_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PickupRequest_branchId_module_idx" ON public."PickupRequest" USING btree ("branchId", module);


--
-- Name: PickupRequest_convertedOrderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PickupRequest_convertedOrderId_key" ON public."PickupRequest" USING btree ("convertedOrderId");


--
-- Name: PickupRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PickupRequest_createdAt_idx" ON public."PickupRequest" USING btree ("createdAt");


--
-- Name: PickupRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PickupRequest_status_idx" ON public."PickupRequest" USING btree (status);


--
-- Name: PickupRequest_tenantId_branchId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PickupRequest_tenantId_branchId_status_idx" ON public."PickupRequest" USING btree ("tenantId", "branchId", status);


--
-- Name: Plan_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Plan_name_key" ON public."Plan" USING btree (name);


--
-- Name: PromoCode_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PromoCode_code_key" ON public."PromoCode" USING btree (code);


--
-- Name: PromoCode_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PromoCode_isActive_idx" ON public."PromoCode" USING btree ("isActive");


--
-- Name: PromoRedemption_promoCodeId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PromoRedemption_promoCodeId_tenantId_key" ON public."PromoRedemption" USING btree ("promoCodeId", "tenantId");


--
-- Name: PromoRedemption_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PromoRedemption_tenantId_idx" ON public."PromoRedemption" USING btree ("tenantId");


--
-- Name: Referral_referredId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Referral_referredId_key" ON public."Referral" USING btree ("referredId");


--
-- Name: Referral_referrerId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Referral_referrerId_status_idx" ON public."Referral" USING btree ("referrerId", status);


--
-- Name: Role_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Role_tenantId_idx" ON public."Role" USING btree ("tenantId");


--
-- Name: Role_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Role_tenantId_name_key" ON public."Role" USING btree ("tenantId", name);


--
-- Name: SaaSPayment_midtransOrderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SaaSPayment_midtransOrderId_key" ON public."SaaSPayment" USING btree ("midtransOrderId");


--
-- Name: SaaSPayment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaaSPayment_status_idx" ON public."SaaSPayment" USING btree (status);


--
-- Name: SaaSPayment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaaSPayment_tenantId_idx" ON public."SaaSPayment" USING btree ("tenantId");


--
-- Name: SaaSPayment_tenantId_status_coverageStart_coverageEnd_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaaSPayment_tenantId_status_coverageStart_coverageEnd_idx" ON public."SaaSPayment" USING btree ("tenantId", status, "coverageStart", "coverageEnd");


--
-- Name: ServiceGroup_branchId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ServiceGroup_branchId_name_key" ON public."ServiceGroup" USING btree ("branchId", name);


--
-- Name: ServiceGroup_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ServiceGroup_module_idx" ON public."ServiceGroup" USING btree (module);


--
-- Name: Service_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_branchId_idx" ON public."Service" USING btree ("branchId");


--
-- Name: Service_branchId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Service_branchId_name_key" ON public."Service" USING btree ("branchId", name);


--
-- Name: Service_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_isActive_idx" ON public."Service" USING btree ("isActive");


--
-- Name: Service_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Service_module_idx" ON public."Service" USING btree (module);


--
-- Name: StockItem_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockItem_branchId_idx" ON public."StockItem" USING btree ("branchId");


--
-- Name: StockMovement_stockItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockMovement_stockItemId_idx" ON public."StockMovement" USING btree ("stockItemId");


--
-- Name: Subscription_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Subscription_tenantId_key" ON public."Subscription" USING btree ("tenantId");


--
-- Name: SuperAdmin_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SuperAdmin_email_key" ON public."SuperAdmin" USING btree (email);


--
-- Name: SupportTicket_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_category_idx" ON public."SupportTicket" USING btree (category);


--
-- Name: SupportTicket_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_createdAt_idx" ON public."SupportTicket" USING btree ("createdAt");


--
-- Name: SupportTicket_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_priority_idx" ON public."SupportTicket" USING btree (priority);


--
-- Name: SupportTicket_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_status_idx" ON public."SupportTicket" USING btree (status);


--
-- Name: SupportTicket_submittedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_submittedById_idx" ON public."SupportTicket" USING btree ("submittedById");


--
-- Name: SupportTicket_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_tenantId_idx" ON public."SupportTicket" USING btree ("tenantId");


--
-- Name: TelemetryEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelemetryEvent_createdAt_idx" ON public."TelemetryEvent" USING btree ("createdAt");


--
-- Name: TelemetryEvent_kind_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelemetryEvent_kind_createdAt_idx" ON public."TelemetryEvent" USING btree (kind, "createdAt");


--
-- Name: TelemetryEvent_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TelemetryEvent_tenantId_createdAt_idx" ON public."TelemetryEvent" USING btree ("tenantId", "createdAt");


--
-- Name: TenantFeatureFlag_flagId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TenantFeatureFlag_flagId_tenantId_key" ON public."TenantFeatureFlag" USING btree ("flagId", "tenantId");


--
-- Name: TenantFeatureFlag_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantFeatureFlag_tenantId_idx" ON public."TenantFeatureFlag" USING btree ("tenantId");


--
-- Name: Tenant_customDomain_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_customDomain_key" ON public."Tenant" USING btree ("customDomain");


--
-- Name: Tenant_ownerEmail_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_ownerEmail_idx" ON public."Tenant" USING btree ("ownerEmail");


--
-- Name: Tenant_referralCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_referralCode_key" ON public."Tenant" USING btree ("referralCode");


--
-- Name: Tenant_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_slug_idx" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: TicketComment_ticketId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON public."TicketComment" USING btree ("ticketId", "createdAt");


--
-- Name: User_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_branchId_idx" ON public."User" USING btree ("branchId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_qrToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_qrToken_key" ON public."User" USING btree ("qrToken");


--
-- Name: User_roleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_roleId_idx" ON public."User" USING btree ("roleId");


--
-- Name: User_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_tenantId_idx" ON public."User" USING btree ("tenantId");


--
-- Name: BlogPost BlogPost_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlogPost"
    ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."SuperAdmin"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Branch Branch_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClockEvent ClockEvent_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClockEvent"
    ADD CONSTRAINT "ClockEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClockEvent ClockEvent_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClockEvent"
    ADD CONSTRAINT "ClockEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Customer Customer_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepositTransaction DepositTransaction_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepositTransaction"
    ADD CONSTRAINT "DepositTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepositTransaction DepositTransaction_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepositTransaction"
    ADD CONSTRAINT "DepositTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DepositTransaction DepositTransaction_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DepositTransaction"
    ADD CONSTRAINT "DepositTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ExpenseCategory ExpenseCategory_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Expense Expense_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Expense Expense_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."ExpenseCategory"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrderPhoto OrderPhoto_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderPhoto"
    ADD CONSTRAINT "OrderPhoto_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderPhoto OrderPhoto_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderPhoto"
    ADD CONSTRAINT "OrderPhoto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Payment Payment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PickupRequest PickupRequest_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PickupRequest"
    ADD CONSTRAINT "PickupRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PickupRequest PickupRequest_convertedOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PickupRequest"
    ADD CONSTRAINT "PickupRequest_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PickupRequest PickupRequest_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PickupRequest"
    ADD CONSTRAINT "PickupRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PickupRequest PickupRequest_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PickupRequest"
    ADD CONSTRAINT "PickupRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PromoRedemption PromoRedemption_promoCodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoRedemption"
    ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES public."PromoCode"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PromoRedemption PromoRedemption_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PromoRedemption"
    ADD CONSTRAINT "PromoRedemption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Referral Referral_referredId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Referral"
    ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Referral Referral_referrerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Referral"
    ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Role Role_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SaaSPayment SaaSPayment_promoCodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaaSPayment"
    ADD CONSTRAINT "SaaSPayment_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES public."PromoCode"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SaaSPayment SaaSPayment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaaSPayment"
    ADD CONSTRAINT "SaaSPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceGroup ServiceGroup_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ServiceGroup"
    ADD CONSTRAINT "ServiceGroup_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Service Service_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Service Service_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."ServiceGroup"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StockItem StockItem_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockItem"
    ADD CONSTRAINT "StockItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockMovement StockMovement_stockItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES public."StockItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."Plan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Subscription Subscription_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportTicket SupportTicket_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TenantFeatureFlag TenantFeatureFlag_flagId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantFeatureFlag"
    ADD CONSTRAINT "TenantFeatureFlag_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES public."FeatureFlag"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantFeatureFlag TenantFeatureFlag_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantFeatureFlag"
    ADD CONSTRAINT "TenantFeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TicketComment TicketComment_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TicketComment"
    ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."SupportTicket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


