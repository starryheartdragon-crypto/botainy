import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const allowedBuckets = new Set(['avatars', 'chatroom-backgrounds'])

export async function POST(req: NextRequest) {
  try {
    console.log('[Upload] Request received')

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const bucketRaw = String(formData.get('bucket') || 'avatars').trim()
    const bucket = allowedBuckets.has(bucketRaw) ? bucketRaw : null
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!bucket) {
      return NextResponse.json({ error: 'Invalid upload bucket' }, { status: 400 })
    }

    console.log('[Upload] File:', file.name, 'Size:', file.size, 'Bucket:', bucket)

    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

    // Use service role for uploads to avoid RLS issues
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    
    const buffer = await file.arrayBuffer()
    let usedBucket = bucket
    let { data, error } = await serviceClient.storage
      .from(usedBucket)
      .upload(filePath, buffer, { upsert: true, contentType: file.type })

    if (error && usedBucket === 'chatroom-backgrounds') {
      const fallbackAttempt = await serviceClient.storage
        .from('avatars')
        .upload(filePath, buffer, { upsert: true, contentType: file.type })
      data = fallbackAttempt.data
      error = fallbackAttempt.error
      usedBucket = 'avatars'
    }

    if (error) {
      console.error('[Upload] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Upload] Uploaded:', filePath)

    // Get public URL
    const { data: urlData } = serviceClient.storage
      .from(usedBucket)
      .getPublicUrl(filePath)

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
    })
  } catch (err: unknown) {
    console.error('[Upload] Exception:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
