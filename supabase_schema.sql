-- Run this in Supabase SQL Editor once, after creating your project.
-- Dashboard: your project → SQL Editor → New query → paste all this → Run.

create table if not exists users (
  id                    text primary key,
  username              text unique not null,
  display_name          text,
  password_hash         text not null,
  password_salt         text not null,
  verified              boolean default true,
  verification_token    text,
  verification_expires  text,
  created_at            text
);

create index if not exists idx_users_username on users (username);
create index if not exists idx_users_verification_token on users (verification_token) where verification_token is not null;

create table if not exists tokens (
  token       text primary key,
  user_id     text not null,
  created_at  text,
  expires_at  text
);

create index if not exists idx_tokens_user on tokens (user_id);

create table if not exists favorites (
  id          bigserial primary key,
  user_id     text not null,
  song_id     text not null,
  song        jsonb not null,
  created_at  text,
  unique (user_id, song_id)
);

create index if not exists idx_favorites_user on favorites (user_id, created_at desc);

create table if not exists recent_plays (
  id          bigserial primary key,
  user_id     text not null,
  song_id     text not null,
  song        jsonb not null,
  played_at   text
);

create index if not exists idx_recent_user_time on recent_plays (user_id, played_at desc);

create table if not exists playlists (
  id                text primary key,
  user_id           text not null,
  name              text not null,
  description       text,
  is_collaborative  boolean default false,
  created_at        text,
  updated_at        text
);

create index if not exists idx_playlists_user on playlists (user_id, updated_at desc);

create table if not exists playlist_items (
  id            bigserial primary key,
  playlist_id   text not null references playlists(id) on delete cascade,
  position      integer not null,
  song          jsonb not null,
  added_at      text
);

create index if not exists idx_playlist_items_pl on playlist_items (playlist_id, position);

create table if not exists playback_state (
  user_id     text primary key,
  state       jsonb not null,
  updated_at  text
);
