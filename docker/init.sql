-- D.A.K MVP v3 Database Schema
-- Lean MVP Specification v1.4 FINAL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS (MVP v3 Compliant)
-- =====================================================

-- Community Types - Strictly enforced, Chinese-wall isolated
CREATE TYPE community_type AS ENUM ('islam', 'christianity', 'hinduism', 'judaism');

-- User roles
CREATE TYPE user_role AS ENUM ('user', 'community_admin', 'platform_admin');

-- Community status
CREATE TYPE community_status AS ENUM ('pending', 'active', 'suspended');

-- Payment status (PSP-led)
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Message thread status
CREATE TYPE thread_status AS ENUM ('active', 'blocked', 'archived');

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    role user_role DEFAULT 'user',
    -- Users are locked to one community type (Chinese-wall)
    community_type community_type,
    -- Password reset
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Waiting list (Public entry - one per community type)
CREATE TABLE waiting_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    recommended_institution VARCHAR(255),
    community_type community_type NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, community_type)
);

-- Communities (Institutions)
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    community_type community_type NOT NULL,
    country VARCHAR(100) NOT NULL,
    status community_status DEFAULT 'pending',
    
    -- Admin CMS fields
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    about_text TEXT,
    head_of_institution VARCHAR(255),
    message_of_day TEXT,
    
    -- Official info (optional)
    official_website VARCHAR(500),
    official_identifier VARCHAR(255),
    short_description TEXT,
    
    -- QR/Invite
    invite_link VARCHAR(255) UNIQUE NOT NULL,
    qr_code_url VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Community admins (single admin per community for MVP)
CREATE TABLE community_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    admin_name VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    role_in_institution VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id)  -- Single admin per community for MVP
);

-- Community memberships (User joins via QR/invite)
CREATE TABLE community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_via VARCHAR(50) DEFAULT 'qr', -- 'qr' or 'link'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

-- =====================================================
-- ACTIVE COMMUNITY ACCESS (Core Business Logic)
-- =====================================================

-- Active Community Access per user per community
-- Time-bound state unlocking participation capabilities
CREATE TABLE active_community_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    
    -- Access expiry (rolling extension, never resets)
    access_expires_at TIMESTAMP NOT NULL,
    
    -- Credit bucket for payments beyond 90-day cap (dollar amount, hidden from user)
    credit_amount DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)
);

-- Payments (PSP-led, Stripe only for MVP)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status payment_status DEFAULT 'pending',
    
    -- PSP details (Stripe)
    psp_transaction_id VARCHAR(255),
    psp_checkout_url VARCHAR(500),
    
    -- Access granted
    days_granted INTEGER NOT NULL,
    
    -- Donation details
    donation_method VARCHAR(50) DEFAULT 'card',
    comment TEXT,

    -- Platform fee (calculated per sliding scale)
    platform_fee DECIMAL(10, 2),
    platform_fee_percent DECIMAL(5, 2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly community activity (for platform fee calculation)
CREATE TABLE monthly_community_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    total_collected DECIMAL(10, 2) DEFAULT 0,
    platform_fee_total DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, year_month)
);

-- =====================================================
-- EVENTS & CALENDAR
-- =====================================================

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP,
    location VARCHAR(255),
    is_virtual BOOLEAN DEFAULT FALSE,
    video_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- STREAMING (with limits)
-- =====================================================

CREATE TABLE streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scheduling
    scheduled_for TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    
    -- Status
    is_live BOOLEAN DEFAULT FALSE,
    duration_minutes INTEGER DEFAULT 0,
    
    -- Viewer tracking
    current_viewers INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    total_view_count INTEGER DEFAULT 0,
    
    -- Recording (1 included, gated behind Active Access)
    recording_url VARCHAR(500),
    recording_teaser_url VARCHAR(500),
    
    -- Week tracking for 2/week limit
    week_number INTEGER, -- ISO week number
    week_year INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream viewers (for capacity tracking - 40% cap)
CREATE TABLE stream_viewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    UNIQUE(stream_id, user_id)
);

-- =====================================================
-- MESSAGING (Private threaded inbox)
-- =====================================================

CREATE TABLE message_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status thread_status DEFAULT 'active',
    is_blocked BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unread_count_user INTEGER DEFAULT 0,
    unread_count_admin INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_from_admin BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- NOTIFICATIONS (In-app only for MVP)
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    reference_type VARCHAR(50),
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ANALYTICS (Internal)
-- =====================================================

-- Subscriber = user with Active Community Access
CREATE TABLE community_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Subscriber metrics
    active_subscribers INTEGER DEFAULT 0,
    new_subscribers INTEGER DEFAULT 0,
    churned_subscribers INTEGER DEFAULT 0,
    
    -- Financial
    total_collected DECIMAL(10, 2) DEFAULT 0,
    platform_fee DECIMAL(10, 2) DEFAULT 0,
    
    -- Engagement
    stream_views INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    
    UNIQUE(community_id, date)
);

-- Platform-wide analytics (admin only)
CREATE TABLE platform_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    total_communities INTEGER DEFAULT 0,
    active_communities INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    active_subscribers INTEGER DEFAULT 0,
    gmv DECIMAL(12, 2) DEFAULT 0,  -- Gross Merchandise Value
    platform_revenue DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_community_type ON users(community_type);
CREATE UNIQUE INDEX idx_communities_name_lower ON communities(LOWER(name));
CREATE INDEX idx_communities_status ON communities(status);
CREATE INDEX idx_communities_type ON communities(community_type);
CREATE INDEX idx_communities_invite ON communities(invite_link);
CREATE INDEX idx_memberships_user ON community_memberships(user_id);
CREATE INDEX idx_memberships_community ON community_memberships(community_id);
CREATE INDEX idx_access_user ON active_community_access(user_id);
CREATE INDEX idx_access_community ON active_community_access(community_id);
CREATE INDEX idx_access_expires ON active_community_access(access_expires_at);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_community ON payments(community_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_events_community ON events(community_id);
CREATE INDEX idx_events_starts ON events(starts_at);
CREATE INDEX idx_streams_community ON streams(community_id);
CREATE INDEX idx_streams_live ON streams(is_live);
CREATE INDEX idx_streams_week ON streams(community_id, week_year, week_number);
CREATE INDEX idx_threads_user ON message_threads(user_id);
CREATE INDEX idx_threads_community ON message_threads(community_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_waiting_list_type ON waiting_list(community_type);

-- =====================================================
-- SEED DATA (Demo)
-- =====================================================

-- Platform admin (password: admin123)
INSERT INTO users (id, email, password_hash, name, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'admin@dak.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Platform Admin', 'platform_admin');

-- Community admins (password: admin123)
INSERT INTO users (id, email, password_hash, name, role, community_type) VALUES
('a0000000-0000-0000-0000-000000000002', 'rabbi@temple.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Rabbi David Cohen', 'community_admin', 'judaism'),
('a0000000-0000-0000-0000-000000000005', 'pastor@stmary.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Pastor James Smith', 'community_admin', 'christianity'),
('a0000000-0000-0000-0000-000000000006', 'imam@islamic.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Imam Ahmad Hassan', 'community_admin', 'islam'),
('a0000000-0000-0000-0000-000000000007', 'pandit@temple.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Pandit Sharma', 'community_admin', 'hinduism'),
('a0000000-0000-0000-0000-000000000020', 'cantor@shalom.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Cantor Rachel Levy', 'community_admin', 'judaism');

-- Regular users / devotees (password: admin123)
-- Judaism devotees
INSERT INTO users (id, email, password_hash, name, role, community_type) VALUES
('a0000000-0000-0000-0000-000000000003', 'sarah@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Sarah Miller', 'user', 'judaism'),
('a0000000-0000-0000-0000-000000000004', 'david@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'David Green', 'user', 'judaism'),
('a0000000-0000-0000-0000-000000000021', 'rachel@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Rachel Goldstein', 'user', 'judaism');

-- Christianity devotees
INSERT INTO users (id, email, password_hash, name, role, community_type) VALUES
('a0000000-0000-0000-0000-000000000010', 'mary@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Mary Johnson', 'user', 'christianity'),
('a0000000-0000-0000-0000-000000000011', 'john@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'John Adams', 'user', 'christianity');

-- Islam devotees
INSERT INTO users (id, email, password_hash, name, role, community_type) VALUES
('a0000000-0000-0000-0000-000000000012', 'fatima@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Fatima Al-Rashid', 'user', 'islam'),
('a0000000-0000-0000-0000-000000000013', 'omar@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Omar Khalil', 'user', 'islam');

-- Hinduism devotees
INSERT INTO users (id, email, password_hash, name, role, community_type) VALUES
('a0000000-0000-0000-0000-000000000014', 'priya@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Priya Patel', 'user', 'hinduism'),
('a0000000-0000-0000-0000-000000000015', 'arjun@example.com', '$2b$10$678wuS1uREuaiitdzK5hZ.3QYSc8i0uyt26UoE8UJl8QECsErjyuK', 'Arjun Sharma', 'user', 'hinduism');

-- Communities (one per type for demo)
INSERT INTO communities (id, name, community_type, country, status, invite_link, about_text, head_of_institution, message_of_day, short_description, logo_url, cover_image_url) VALUES
('c0000000-0000-0000-0000-000000000001', 'Temple Beth Israel', 'judaism', 'United States', 'active', 'temple-beth-israel',
 'A welcoming Jewish community dedicated to Torah study, prayer, and acts of loving kindness.',
 'Rabbi David Cohen',
 'Shalom! May this day bring you peace and wisdom.',
 'Historic synagogue serving the Jewish community since 1952',
 'https://images.unsplash.com/photo-1549298240-0d8e60513026?w=400',
 'https://images.unsplash.com/photo-1549298240-0d8e60513026?w=800'),

('c0000000-0000-0000-0000-000000000002', 'St. Mary Cathedral', 'christianity', 'United States', 'active', 'st-mary-cathedral',
 'A historic cathedral serving the faithful with worship, community, and outreach.',
 'Pastor James Smith',
 'May the grace of our Lord Jesus Christ be with you today.',
 'Gothic cathedral in the heart of downtown',
 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=400',
 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800'),

('c0000000-0000-0000-0000-000000000003', 'Islamic Center of Peace', 'islam', 'United States', 'active', 'islamic-center-peace',
 'A center for Islamic learning, prayer, and community service.',
 'Imam Ahmad Hassan',
 'Assalamu Alaikum - Peace be upon you.',
 'Serving the Muslim community with daily prayers and education',
 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=400',
 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800'),

('c0000000-0000-0000-0000-000000000004', 'Shri Krishna Temple', 'hinduism', 'United States', 'active', 'shri-krishna-temple',
 'A temple dedicated to Lord Krishna and the practice of Bhakti yoga.',
 'Pandit Sharma',
 'Om Namo Bhagavate Vasudevaya',
 'Traditional Hindu temple with daily pujas and festivals',
 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=400',
 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800'),

('c0000000-0000-0000-0000-000000000005', 'Congregation Shalom', 'judaism', 'United States', 'active', 'congregation-shalom',
 'A vibrant Reform synagogue fostering spiritual growth, social justice, and lifelong Jewish learning.',
 'Cantor Rachel Levy',
 'May you find peace and purpose in your day. Shalom!',
 'Reform synagogue known for inclusive worship and community outreach',
 'https://images.unsplash.com/photo-1549298240-0d8e60513026?w=400',
 'https://images.unsplash.com/photo-1549298240-0d8e60513026?w=800');

-- Community admins
INSERT INTO community_admins (community_id, user_id, admin_name, admin_email, role_in_institution) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Rabbi David Cohen', 'rabbi@temple.com', 'Rabbi'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'Pastor James Smith', 'pastor@stmary.com', 'Pastor'),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000006', 'Imam Ahmad Hassan', 'imam@islamic.com', 'Imam'),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 'Pandit Sharma', 'pandit@temple.com', 'Head Priest'),
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000020', 'Cantor Rachel Levy', 'cantor@shalom.com', 'Cantor');

-- Community admin memberships (auto-approved)
INSERT INTO community_memberships (community_id, user_id, joined_via, status) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'admin', 'approved'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'admin', 'approved'),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000006', 'admin', 'approved'),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 'admin', 'approved'),
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000020', 'admin', 'approved');

-- Community memberships (all devotees joined and approved for demo)
INSERT INTO community_memberships (community_id, user_id, joined_via, status) VALUES
-- Judaism
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'link', 'approved'),
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'qr', 'approved'),
-- Sarah also in Congregation Shalom (2nd Judaism institute)
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'link', 'approved'),
-- Congregation Shalom members
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000021', 'qr', 'approved'),
-- Christianity
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000010', 'link', 'approved'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000011', 'qr', 'approved'),
-- Islam
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000012', 'link', 'approved'),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000013', 'qr', 'approved'),
-- Hinduism
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000014', 'link', 'approved'),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000015', 'qr', 'approved');

-- Active Community Access for all demo users
INSERT INTO active_community_access (user_id, community_id, access_expires_at, credit_amount) VALUES
-- Judaism
('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP + INTERVAL '60 days', 0),
('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '5 days', 0),
-- Sarah also in Congregation Shalom
('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', CURRENT_TIMESTAMP + INTERVAL '55 days', 0),
-- Congregation Shalom
('a0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000005', CURRENT_TIMESTAMP + INTERVAL '40 days', 0),
-- Christianity
('a0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP + INTERVAL '45 days', 0),
('a0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', CURRENT_TIMESTAMP - INTERVAL '3 days', 0),
-- Islam
('a0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP + INTERVAL '60 days', 0),
('a0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP - INTERVAL '7 days', 0),
-- Hinduism
('a0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000004', CURRENT_TIMESTAMP + INTERVAL '30 days', 0),
('a0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000004', CURRENT_TIMESTAMP - INTERVAL '2 days', 0);

-- Sample payments (donations) for all communities
INSERT INTO payments (id, user_id, community_id, amount, status, psp_transaction_id, days_granted, donation_method, comment, platform_fee, platform_fee_percent, created_at) VALUES
-- Judaism
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 10.00, 'completed', 'pi_demo_101', 60, 'card', 'Supporting the weekly Shabbat services', 2.50, 25.00, CURRENT_TIMESTAMP - INTERVAL '5 days'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 5.00, 'completed', 'pi_demo_102', 30, 'card', NULL, 1.25, 25.00, CURRENT_TIMESTAMP - INTERVAL '15 days'),
-- Congregation Shalom
('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 18.00, 'completed', 'pi_demo_103', 60, 'card', 'Supporting the community programs', 4.50, 25.00, CURRENT_TIMESTAMP - INTERVAL '6 days'),
('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000005', 10.00, 'completed', 'pi_demo_104', 45, 'card', 'For the youth education fund', 2.50, 25.00, CURRENT_TIMESTAMP - INTERVAL '9 days'),
-- Christianity
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000002', 15.00, 'completed', 'pi_demo_201', 60, 'card', 'For the Sunday school program', 3.75, 25.00, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 20.00, 'completed', 'pi_demo_202', 90, 'card', 'God bless this community', 4.00, 20.00, CURRENT_TIMESTAMP - INTERVAL '10 days'),
-- Islam
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000003', 25.00, 'completed', 'pi_demo_301', 90, 'card', 'Sadaqah for Ramadan', 5.00, 20.00, CURRENT_TIMESTAMP - INTERVAL '7 days'),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 8.00, 'completed', 'pi_demo_302', 30, 'card', NULL, 2.00, 25.00, CURRENT_TIMESTAMP - INTERVAL '12 days'),
-- Hinduism
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000004', 12.00, 'completed', 'pi_demo_401', 60, 'card', 'For the Diwali celebrations', 3.00, 25.00, CURRENT_TIMESTAMP - INTERVAL '4 days'),
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000004', 7.00, 'completed', 'pi_demo_402', 30, 'card', 'Om Shanti', 1.75, 25.00, CURRENT_TIMESTAMP - INTERVAL '8 days');

-- Sample events
INSERT INTO events (id, community_id, title, description, starts_at, ends_at, location, is_virtual, video_url) VALUES
('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Shabbat Service', 'Weekly Friday evening service with candle lighting', CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '2 days' + INTERVAL '2 hours', 'Main Sanctuary', FALSE, 'https://www.youtube.com/watch?v=jNQXAC9IVRw'),
('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Torah Study', 'Weekly Torah study with Rabbi Cohen', CURRENT_TIMESTAMP + INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '3 days' + INTERVAL '90 minutes', 'Library', FALSE, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Online Havdalah', 'Virtual Havdalah ceremony via livestream', CURRENT_TIMESTAMP + INTERVAL '3 days' + INTERVAL '4 hours', CURRENT_TIMESTAMP + INTERVAL '3 days' + INTERVAL '5 hours', NULL, TRUE, 'https://www.youtube.com/watch?v=9bZkp7q19f0');

-- Sample streams (with week tracking)
INSERT INTO streams (id, community_id, title, description, scheduled_for, is_live, week_number, week_year, recording_url, recording_teaser_url) VALUES
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Shabbat Morning Service', 'Live broadcast of our Shabbat morning service', CURRENT_TIMESTAMP + INTERVAL '3 days', FALSE, EXTRACT(WEEK FROM CURRENT_TIMESTAMP)::INTEGER, EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::INTEGER, 'https://www.youtube.com/watch?v=jNQXAC9IVRw', NULL),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Torah Study Live', 'Interactive Torah study session', NULL, TRUE, EXTRACT(WEEK FROM CURRENT_TIMESTAMP)::INTEGER, EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::INTEGER, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL);

-- Sample message thread
INSERT INTO message_threads (id, community_id, user_id, last_message_at) VALUES
('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP);

INSERT INTO messages (thread_id, sender_id, content, is_from_admin, is_read) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Shalom Rabbi, I have a question about the upcoming High Holidays.', FALSE, TRUE),
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Shalom Sarah! Of course, I would be happy to help. What would you like to know?', TRUE, FALSE);

-- Sample notifications
INSERT INTO notifications (user_id, community_id, type, title, message, created_at) VALUES
('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'event', 'Upcoming Event', 'Shabbat Service is in 2 days', CURRENT_TIMESTAMP),
('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'stream', 'Stream Scheduled', 'Shabbat Morning Service livestream has been scheduled', CURRENT_TIMESTAMP - INTERVAL '1 day');

-- Sample waiting list entries
INSERT INTO waiting_list (email, recommended_institution, community_type) VALUES
('john@example.com', 'First Baptist Church', 'christianity'),
('fatima@example.com', 'Al-Noor Mosque', 'islam'),
('priya@example.com', 'Lakshmi Temple', 'hinduism');
