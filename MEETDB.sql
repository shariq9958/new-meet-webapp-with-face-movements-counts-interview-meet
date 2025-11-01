--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

-- Started on 2025-11-01 11:07:44

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
-- TOC entry 228 (class 1255 OID 32768)
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_set_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 32998)
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    sender_id uuid,
    sender_name character varying(100),
    message_text text NOT NULL,
    sent_at timestamp without time zone DEFAULT now() NOT NULL,
    is_system_message boolean DEFAULT false
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 32977)
-- Name: meeting_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meeting_participants (
    participant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    user_id uuid,
    guest_name character varying(100),
    guest_email character varying(100),
    join_time timestamp without time zone DEFAULT now() NOT NULL,
    leave_time timestamp without time zone,
    is_approved boolean DEFAULT true,
    device_info text,
    CONSTRAINT participant_type CHECK (((user_id IS NOT NULL) OR (guest_name IS NOT NULL)))
);


ALTER TABLE public.meeting_participants OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 32960)
-- Name: meetings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meetings (
    meeting_id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id character varying(100) NOT NULL,
    title character varying(255),
    host_user_id uuid,
    is_locked boolean DEFAULT false,
    is_active boolean DEFAULT true,
    meeting_password character varying(100),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    ended_at timestamp without time zone,
    max_participants integer DEFAULT 10
);


ALTER TABLE public.meetings OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 32936)
-- Name: payment_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_records (
    payment_record_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    payment_id character varying(255),
    order_id character varying(255) NOT NULL,
    amount integer NOT NULL,
    currency character varying(10) DEFAULT 'INR'::character varying NOT NULL,
    payment_method character varying(50) DEFAULT 'razorpay'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    payment_date timestamp without time zone NOT NULL,
    refund_id character varying(255),
    refund_date timestamp without time zone,
    refund_amount integer,
    invoice_number character varying(100),
    invoice_url character varying(255),
    payment_details jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_records_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.payment_records OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 32796)
-- Name: plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plans (
    plan_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_name character varying(100) NOT NULL,
    user_type_id integer NOT NULL,
    price_monthly_inr numeric(10,2),
    price_annual_inr numeric(10,2),
    interview_limit_monthly integer,
    host_account_limit integer,
    features_description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    plan_code character varying(50)
);


ALTER TABLE public.plans OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 33018)
-- Name: pricing_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pricing_plans (
    plan_id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_name character varying(50) NOT NULL,
    plan_type character varying(20) NOT NULL,
    price_monthly integer NOT NULL,
    price_yearly integer,
    currency character varying(10) DEFAULT 'INR'::character varying NOT NULL,
    description text,
    features jsonb,
    max_meeting_duration integer,
    max_participants integer,
    recording_allowed boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT pricing_plans_plan_type_check CHECK (((plan_type)::text = ANY ((ARRAY['student'::character varying, 'starter'::character varying, 'professional'::character varying, 'enterprise'::character varying])::text[])))
);


ALTER TABLE public.pricing_plans OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 32916)
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    subscription_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'inactive'::character varying NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    is_auto_renew boolean DEFAULT true,
    cancel_date timestamp without time zone,
    cancel_reason text,
    renewal_count integer DEFAULT 0,
    last_renewed_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_plan_type_check CHECK (((plan_type)::text = ANY ((ARRAY['student'::character varying, 'starter'::character varying, 'professional'::character varying, 'enterprise'::character varying])::text[]))),
    CONSTRAINT subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 32813)
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_subscriptions (
    subscription_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    start_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_date timestamp with time zone,
    next_billing_date timestamp with time zone,
    billing_cycle character varying(20),
    status character varying(20) DEFAULT 'pending_payment'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_subscriptions_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'annually'::character varying])::text[]))),
    CONSTRAINT user_subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'pending_payment'::character varying, 'failed_payment'::character varying, 'trialing'::character varying])::text[])))
);


ALTER TABLE public.user_subscriptions OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 32770)
-- Name: user_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_types (
    user_type_id integer NOT NULL,
    type_name character varying(50) NOT NULL
);


ALTER TABLE public.user_types OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 32769)
-- Name: user_types_user_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_types_user_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_types_user_type_id_seq OWNER TO postgres;

--
-- TOC entry 5053 (class 0 OID 0)
-- Dependencies: 217
-- Name: user_types_user_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_types_user_type_id_seq OWNED BY public.user_types.user_type_id;


--
-- TOC entry 219 (class 1259 OID 32778)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255),
    user_type_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    subscription_status character varying(20) DEFAULT 'inactive'::character varying,
    subscription_start_date timestamp with time zone,
    subscription_end_date timestamp with time zone,
    plan_type character varying(20),
    payment_id character varying(100),
    razorpay_customer_id character varying(100),
    last_payment_date timestamp with time zone,
    next_billing_date timestamp with time zone,
    is_auto_renew boolean DEFAULT true
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 4781 (class 2604 OID 32773)
-- Name: user_types user_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_types ALTER COLUMN user_type_id SET DEFAULT nextval('public.user_types_user_type_id_seq'::regclass);


--
-- TOC entry 5036 (class 0 OID 32998)
-- Dependencies: 226
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_messages (message_id, meeting_id, sender_id, sender_name, message_text, sent_at, is_system_message) FROM stdin;
\.


--
-- TOC entry 5035 (class 0 OID 32977)
-- Dependencies: 225
-- Data for Name: meeting_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.meeting_participants (participant_id, meeting_id, user_id, guest_name, guest_email, join_time, leave_time, is_approved, device_info) FROM stdin;
\.


--
-- TOC entry 5034 (class 0 OID 32960)
-- Dependencies: 224
-- Data for Name: meetings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.meetings (meeting_id, room_id, title, host_user_id, is_locked, is_active, meeting_password, created_at, ended_at, max_participants) FROM stdin;
\.


--
-- TOC entry 5033 (class 0 OID 32936)
-- Dependencies: 223
-- Data for Name: payment_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_records (payment_record_id, user_id, subscription_id, payment_id, order_id, amount, currency, payment_method, status, payment_date, refund_id, refund_date, refund_amount, invoice_number, invoice_url, payment_details, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5030 (class 0 OID 32796)
-- Dependencies: 220
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plans (plan_id, plan_name, user_type_id, price_monthly_inr, price_annual_inr, interview_limit_monthly, host_account_limit, features_description, is_active, created_at, updated_at, plan_code) FROM stdin;
14724c67-5b61-418b-a5d0-8904c576604e	Enterprise	1	\N	\N	\N	\N	Unlimited Interviews, Custom Host Accounts, Premium Analysis & API, Dedicated Support & SLA	t	2025-05-17 11:51:03.015054+05:30	2025-05-17 11:51:03.015054+05:30	\N
d526c8e1-bf0a-4beb-9217-c6780e93fab2	Student Access	2	99.00	\N	\N	1	Unlimited 1-to-1 Practice Sessions, Real-Time Basic AI Feedback, HD Video & Audio Quality, Easy Room Creation & Joining, Community Forum Support	t	2025-05-17 11:51:03.015054+05:30	2025-05-17 11:51:03.015054+05:30	\N
98714a1a-a430-439f-8066-98be326ba661	Starter	1	3500.00	33600.00	100	3	Up to 100 Interviews, 1-3 Host Accounts, Standard Interview Analysis	t	2025-05-17 11:51:03.015054+05:30	2025-05-17 13:13:35.626421+05:30	starter
92c34fdb-70e1-4d31-a67f-239d11369eb7	Professional	1	15000.00	144000.00	1000	10	Up to 1000 Interviews, 5-10 Host Accounts, Full Analysis & Reports, Company Branding	t	2025-05-17 11:51:03.015054+05:30	2025-05-17 13:13:35.626421+05:30	professional
f904b9fe-94f4-4885-aaec-576dc24d236d	Student Access Plan	2	99.00	\N	\N	\N	Access to student features	t	2025-05-17 13:17:54.97984+05:30	2025-05-17 13:17:54.97984+05:30	student_access
\.


--
-- TOC entry 5037 (class 0 OID 33018)
-- Dependencies: 227
-- Data for Name: pricing_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pricing_plans (plan_id, plan_name, plan_type, price_monthly, price_yearly, currency, description, features, max_meeting_duration, max_participants, recording_allowed, is_active, created_at, updated_at) FROM stdin;
338c29c8-a494-4e0f-86b9-9b76a91a0ffb	Student Plan	student	99	\N	INR	Affordable plan for students	["Unlimited Meetings", "HD Video", "Screen Sharing", "Join via Link"]	60	5	f	t	2025-05-23 12:41:39.881014	2025-05-23 12:41:39.881014
90e75f24-b740-47a7-9dbb-1adf79d77641	Starter Plan	starter	3500	\N	INR	Small business plan	["Everything in Student Plan", "Longer Meetings", "Cloud Recording", "Custom Branding"]	120	20	t	t	2025-05-23 12:41:39.881014	2025-05-23 12:41:39.881014
808e69b6-6cbf-4377-b2a8-6bd3fb306ef0	Professional Plan	professional	15000	\N	INR	Full featured plan for companies	["Everything in Starter Plan", "Advanced Security", "Analytics", "Priority Support"]	240	50	t	t	2025-05-23 12:41:39.881014	2025-05-23 12:41:39.881014
f15748e2-5a86-4318-a339-de29b3edab3b	Enterprise Plan	enterprise	50000	\N	INR	Enterprise grade solution	["Everything in Professional Plan", "SSO Integration", "Dedicated Support", "Custom Development"]	480	100	t	t	2025-05-23 12:41:39.881014	2025-05-23 12:41:39.881014
\.


--
-- TOC entry 5032 (class 0 OID 32916)
-- Dependencies: 222
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (subscription_id, user_id, plan_type, status, start_date, end_date, is_auto_renew, cancel_date, cancel_reason, renewal_count, last_renewed_date, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5031 (class 0 OID 32813)
-- Dependencies: 221
-- Data for Name: user_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_subscriptions (subscription_id, user_id, plan_id, start_date, end_date, next_billing_date, billing_cycle, status, created_at, updated_at) FROM stdin;
0d31471e-6d48-42c5-8344-946e4034bd11	7502e6f4-2e25-48fd-821b-df0ada021c59	f904b9fe-94f4-4885-aaec-576dc24d236d	2025-05-17 13:18:25.622734+05:30	\N	\N	monthly	active	2025-05-17 13:18:25.616963+05:30	2025-05-17 13:18:25.616963+05:30
def34f05-7636-4070-8471-bb6a36eea3f4	7c12031e-4d0e-43a6-8a3d-4f9fc4a8f713	f904b9fe-94f4-4885-aaec-576dc24d236d	2025-05-18 22:43:11.67232+05:30	\N	\N	monthly	active	2025-05-18 22:43:11.668608+05:30	2025-05-18 22:43:11.668608+05:30
\.


--
-- TOC entry 5028 (class 0 OID 32770)
-- Dependencies: 218
-- Data for Name: user_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_types (user_type_id, type_name) FROM stdin;
1	company
2	student
3	admin
\.


--
-- TOC entry 5029 (class 0 OID 32778)
-- Dependencies: 219
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, email, password_hash, full_name, user_type_id, created_at, updated_at, subscription_status, subscription_start_date, subscription_end_date, plan_type, payment_id, razorpay_customer_id, last_payment_date, next_billing_date, is_auto_renew) FROM stdin;
7502e6f4-2e25-48fd-821b-df0ada021c59	shariqq@gmail.com	$2b$12$JGpgbO6cvTy.lqR5H/8Yyenls5BTdov2CTas7j7xqCq/mO7P.vxea	mohammad shariq	2	2025-05-17 13:18:24.794962+05:30	2025-05-17 13:18:24.794962+05:30	inactive	\N	\N	\N	\N	\N	\N	\N	t
7c12031e-4d0e-43a6-8a3d-4f9fc4a8f713	shariqqq@gmail.com	$2b$12$j51GG0JM3AbCKzy4BICh0eTeF.0qGvwZUsjugNNn2IMwWnoqq1yH.	mohammad shariq	2	2025-05-18 22:43:10.927865+05:30	2025-05-18 22:43:10.927865+05:30	inactive	\N	\N	\N	\N	\N	\N	\N	t
a6d6c904-150f-4fe0-a72d-dc8a50075888	yaseen009@aol.com	$2b$12$D4ChLX20E/pYuyAN1t7my.ILr59dbRC0YWrhA1c5QfHPnjrJtx0wy	yaseen mohammad	2	2025-05-20 11:48:10.523514+05:30	2025-05-20 11:48:10.523514+05:30	inactive	\N	\N	\N	\N	\N	\N	\N	t
\.


--
-- TOC entry 5056 (class 0 OID 0)
-- Dependencies: 217
-- Name: user_types_user_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_types_user_type_id_seq', 3, true);


--
-- TOC entry 4863 (class 2606 OID 33007)
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (message_id);


--
-- TOC entry 4861 (class 2606 OID 32987)
-- Name: meeting_participants meeting_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_pkey PRIMARY KEY (participant_id);


--
-- TOC entry 4856 (class 2606 OID 32969)
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (meeting_id);


--
-- TOC entry 4858 (class 2606 OID 32971)
-- Name: meetings meetings_room_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_room_id_key UNIQUE (room_id);


--
-- TOC entry 4853 (class 2606 OID 32949)
-- Name: payment_records payment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_pkey PRIMARY KEY (payment_record_id);


--
-- TOC entry 4842 (class 2606 OID 32806)
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (plan_id);


--
-- TOC entry 4844 (class 2606 OID 32839)
-- Name: plans plans_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_plan_code_key UNIQUE (plan_code);


--
-- TOC entry 4866 (class 2606 OID 33031)
-- Name: pricing_plans pricing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_plans
    ADD CONSTRAINT pricing_plans_pkey PRIMARY KEY (plan_id);


--
-- TOC entry 4849 (class 2606 OID 32930)
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (subscription_id);


--
-- TOC entry 4846 (class 2606 OID 32824)
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (subscription_id);


--
-- TOC entry 4833 (class 2606 OID 32775)
-- Name: user_types user_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_types
    ADD CONSTRAINT user_types_pkey PRIMARY KEY (user_type_id);


--
-- TOC entry 4835 (class 2606 OID 32777)
-- Name: user_types user_types_type_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_types
    ADD CONSTRAINT user_types_type_name_key UNIQUE (type_name);


--
-- TOC entry 4838 (class 2606 OID 32789)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4840 (class 2606 OID 32787)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4864 (class 1259 OID 33038)
-- Name: idx_chat_messages_meeting_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_meeting_id ON public.chat_messages USING btree (meeting_id);


--
-- TOC entry 4859 (class 1259 OID 33037)
-- Name: idx_meeting_participants_meeting_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants USING btree (meeting_id);


--
-- TOC entry 4854 (class 1259 OID 33036)
-- Name: idx_meetings_room_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meetings_room_id ON public.meetings USING btree (room_id);


--
-- TOC entry 4850 (class 1259 OID 33035)
-- Name: idx_payment_records_subscription_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_records_subscription_id ON public.payment_records USING btree (subscription_id);


--
-- TOC entry 4851 (class 1259 OID 33034)
-- Name: idx_payment_records_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_records_user_id ON public.payment_records USING btree (user_id);


--
-- TOC entry 4847 (class 1259 OID 33033)
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- TOC entry 4836 (class 1259 OID 33032)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 4880 (class 2620 OID 32812)
-- Name: plans set_plans_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- TOC entry 4881 (class 2620 OID 32835)
-- Name: user_subscriptions set_user_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- TOC entry 4879 (class 2620 OID 32795)
-- Name: users set_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- TOC entry 4877 (class 2606 OID 33008)
-- Name: chat_messages chat_messages_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(meeting_id);


--
-- TOC entry 4878 (class 2606 OID 33013)
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id);


--
-- TOC entry 4868 (class 2606 OID 32807)
-- Name: plans fk_plan_user_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT fk_plan_user_type FOREIGN KEY (user_type_id) REFERENCES public.user_types(user_type_id);


--
-- TOC entry 4869 (class 2606 OID 32830)
-- Name: user_subscriptions fk_subscription_plan; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT fk_subscription_plan FOREIGN KEY (plan_id) REFERENCES public.plans(plan_id);


--
-- TOC entry 4870 (class 2606 OID 32825)
-- Name: user_subscriptions fk_subscription_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 4867 (class 2606 OID 32790)
-- Name: users fk_user_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_user_type FOREIGN KEY (user_type_id) REFERENCES public.user_types(user_type_id);


--
-- TOC entry 4875 (class 2606 OID 32988)
-- Name: meeting_participants meeting_participants_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(meeting_id);


--
-- TOC entry 4876 (class 2606 OID 32993)
-- Name: meeting_participants meeting_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 4874 (class 2606 OID 32972)
-- Name: meetings meetings_host_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES public.users(user_id);


--
-- TOC entry 4872 (class 2606 OID 32955)
-- Name: payment_records payment_records_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(subscription_id);


--
-- TOC entry 4873 (class 2606 OID 32950)
-- Name: payment_records payment_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 4871 (class 2606 OID 32931)
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 5043 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO shariq;


--
-- TOC entry 5044 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE chat_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chat_messages TO shariq;


--
-- TOC entry 5045 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE meeting_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.meeting_participants TO shariq;


--
-- TOC entry 5046 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE meetings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.meetings TO shariq;


--
-- TOC entry 5047 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE payment_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_records TO shariq;


--
-- TOC entry 5048 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE plans; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.plans TO shariq;


--
-- TOC entry 5049 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE pricing_plans; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pricing_plans TO shariq;


--
-- TOC entry 5050 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.subscriptions TO shariq;


--
-- TOC entry 5051 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE user_subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_subscriptions TO shariq;


--
-- TOC entry 5052 (class 0 OID 0)
-- Dependencies: 218
-- Name: TABLE user_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_types TO shariq;


--
-- TOC entry 5054 (class 0 OID 0)
-- Dependencies: 217
-- Name: SEQUENCE user_types_user_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_types_user_type_id_seq TO shariq;


--
-- TOC entry 5055 (class 0 OID 0)
-- Dependencies: 219
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO shariq;


--
-- TOC entry 2082 (class 826 OID 32837)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO shariq;


--
-- TOC entry 2081 (class 826 OID 32836)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO shariq;


-- Completed on 2025-11-01 11:07:44

--
-- PostgreSQL database dump complete
--

