import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateRecipientForm } from '@/lib/validation'
import { getVatZone } from '@/lib/countries'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role === 'user') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const vatZone = getVatZone(body.country_code)
  const formData = { ...body, vat_zone: vatZone }

  const validation = validateRecipientForm(formData)
  if (!validation.valid) {
    return NextResponse.json({ error: 'Validation failed', errors: validation.errors }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recipients')
    .update({
      name:         formData.name,
      type:         formData.type,
      address:      formData.address,
      country_code: formData.country_code,
      country_name: formData.country_name,
      vat_zone:     vatZone,
      vat_number:   formData.vat_number?.toUpperCase() || null,
      email:        formData.email,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipient: data })
}
