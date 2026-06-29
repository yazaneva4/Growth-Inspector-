-- Add email as a supported channel.
alter type social_platform add value if not exists 'email';
