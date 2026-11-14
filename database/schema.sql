--
-- PostgreSQL database dump
--

\restrict ZTyMfwgPaHrRtgh1qa3dK6XlGr2SXkYqbW5goKiqu2ajs8stgoyN3H6VoPUYsdM

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: active_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_clients (
    usdot text NOT NULL,
    contact_name text DEFAULT ''::text NOT NULL,
    contact_phone text DEFAULT ''::text NOT NULL,
    contact_email text DEFAULT ''::text NOT NULL,
    equipment text DEFAULT ''::text NOT NULL,
    truck_count integer DEFAULT 1 NOT NULL,
    start_date date NOT NULL,
    dispatch_fee_percent numeric(5,2),
    preferred_lanes text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    agreement_signed boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT active_clients_dispatch_fee_percent_check CHECK (((dispatch_fee_percent >= (0)::numeric) AND (dispatch_fee_percent <= (100)::numeric))),
    CONSTRAINT active_clients_truck_count_check CHECK ((truck_count >= 1))
);


--
-- Name: auth_login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_login_attempts (
    attempt_key text NOT NULL,
    failures integer DEFAULT 0 NOT NULL,
    last_failure timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    token_hash text NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: auth_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_users (
    id bigint NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auth_users_id_seq OWNED BY public.auth_users.id;


--
-- Name: carriers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carriers (
    usdot text NOT NULL,
    company text NOT NULL,
    state text,
    power_units integer,
    phone text,
    email text,
    classification text,
    authority_verification text,
    equipment text,
    outreach_stage text,
    last_contacted date,
    next_follow_up date,
    notes text,
    verification_source text,
    verification_notes text,
    verification_reviewed_on date
);


--
-- Name: outreach_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outreach_activities (
    id bigint NOT NULL,
    usdot text NOT NULL,
    channel text NOT NULL,
    outcome text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    next_follow_up date,
    stage_after text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT outreach_activities_channel_check CHECK ((channel = ANY (ARRAY['Phone'::text, 'Email'::text, 'LinkedIn'::text, 'Facebook'::text, 'Other'::text]))),
    CONSTRAINT outreach_activities_outcome_check CHECK ((outcome = ANY (ARRAY['No answer'::text, 'Message sent'::text, 'Reply received'::text, 'Interested'::text, 'Follow-up requested'::text, 'Not interested'::text, 'Other'::text])))
);


--
-- Name: outreach_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.outreach_activities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: outreach_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.outreach_activities_id_seq OWNED BY public.outreach_activities.id;


--
-- Name: auth_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users ALTER COLUMN id SET DEFAULT nextval('public.auth_users_id_seq'::regclass);


--
-- Name: outreach_activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_activities ALTER COLUMN id SET DEFAULT nextval('public.outreach_activities_id_seq'::regclass);


--
-- Name: active_clients active_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_clients
    ADD CONSTRAINT active_clients_pkey PRIMARY KEY (usdot);


--
-- Name: auth_login_attempts auth_login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_login_attempts
    ADD CONSTRAINT auth_login_attempts_pkey PRIMARY KEY (attempt_key);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (token_hash);


--
-- Name: auth_users auth_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_pkey PRIMARY KEY (id);


--
-- Name: auth_users auth_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_username_key UNIQUE (username);


--
-- Name: carriers carriers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carriers
    ADD CONSTRAINT carriers_pkey PRIMARY KEY (usdot);


--
-- Name: outreach_activities outreach_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_activities
    ADD CONSTRAINT outreach_activities_pkey PRIMARY KEY (id);


--
-- Name: idx_active_clients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_active_clients_status ON public.active_clients USING btree (archived_at);


--
-- Name: idx_auth_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_sessions_expires ON public.auth_sessions USING btree (expires_at);


--
-- Name: idx_outreach_usdot_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outreach_usdot_date ON public.outreach_activities USING btree (usdot, created_at DESC);


--
-- Name: active_clients active_clients_usdot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_clients
    ADD CONSTRAINT active_clients_usdot_fkey FOREIGN KEY (usdot) REFERENCES public.carriers(usdot);


--
-- Name: auth_sessions auth_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- Name: outreach_activities outreach_activities_usdot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outreach_activities
    ADD CONSTRAINT outreach_activities_usdot_fkey FOREIGN KEY (usdot) REFERENCES public.carriers(usdot) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ZTyMfwgPaHrRtgh1qa3dK6XlGr2SXkYqbW5goKiqu2ajs8stgoyN3H6VoPUYsdM

