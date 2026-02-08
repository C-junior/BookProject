/**
 * Supabase Configuration
 * Client setup for Supabase Storage
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yzdfpjwmtjyzmraifdlh.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_X8L0uFHs8BfTV-mkbuU8iA_-6x9lcOs'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Storage bucket name for books
export const BOOKS_BUCKET = 'books'
