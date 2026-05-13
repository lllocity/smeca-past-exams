import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const imageId = Number(id)
  if (!Number.isInteger(imageId) || imageId <= 0) {
    return NextResponse.json({ error: 'Invalid image id' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: image, error: fetchError } = await supabase
    .from('question_images')
    .select('storage_path')
    .eq('id', imageId)
    .single()

  if (fetchError || !image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  const { error: storageError } = await supabase.storage
    .from('question-images')
    .remove([image.storage_path])

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  const { error: deleteError } = await supabase
    .from('question_images')
    .delete()
    .eq('id', imageId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
