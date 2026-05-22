'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, Loader2, Paperclip, StickyNote, Trash2, UserCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog'
import { useDocumentViewerStore } from '@/stores/document-viewer'
import type { InventoryDocumentRecord } from '@/types/documents'

interface ProjectNoteDocument {
  id: string
  fileName: string
  fileUrl: string
  fileType: string
}

interface ProjectNote {
  id: string
  body: string
  authorType: string
  authorId: string | null
  createdAt: string
  documents: ProjectNoteDocument[]
}

function formatRelative(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function authorLabel(note: ProjectNote) {
  if (note.authorType === 'contractor') return 'Contratista'
  if (note.authorType === 'installer') return 'Instalador'
  return 'Admin'
}

export function ProjectNotesFeed({ projectId, projectName }: { projectId: string; projectName?: string }) {
  const queryClient = useQueryClient()
  const openViewer = useDocumentViewerStore((state) => state.openViewer)
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const { data: notes = [], isLoading } = useQuery<ProjectNote[]>({
    queryKey: ['project-notes', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/notes`).then((r) => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      formData.append('body', body.trim())
      formData.append('authorType', 'admin')
      for (const file of photos) {
        formData.append('files', file)
      }
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la nota')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] })
      setBody('')
      setPhotos([])
      toast.success('Nota agregada')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await fetch(`/api/projects/${projectId}/notes/${noteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo eliminar')
      }
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] })
      setDeletingId(null)
      toast.success('Nota eliminada')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (incoming.length === 0) return
    setPhotos((prev) => [...prev, ...incoming])
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (event.currentTarget === dropRef.current) {
      setIsDraggingOver(false)
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
    if (event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files)
    }
  }

  const canSubmit = (body.trim().length > 0 || photos.length > 0) && !createMutation.isPending

  function openNotePhoto(note: ProjectNote, doc: ProjectNoteDocument) {
    const documents: InventoryDocumentRecord[] = note.documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileType: d.fileType,
      fileUrl: d.fileUrl,
      entityType: 'project',
      entityId: projectId,
      source: 'database',
    }))
    openViewer({
      documents,
      initialDocumentId: doc.id,
      contextTitle: projectName || 'Proyecto',
      contextPath: ['Proyectos', projectName || 'Proyecto', 'Notas'],
    })
  }

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`space-y-2 rounded-md border p-3 transition-colors ${
          isDraggingOver ? 'border-primary bg-primary/5' : 'bg-card'
        }`}
      >
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Escribe una nota… (arrastra fotos aquí o usa el clip)"
          rows={3}
          className="resize-none border-0 px-0 shadow-none focus-visible:ring-0"
        />
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((file, index) => (
              <div
                key={index}
                className="group relative h-16 w-16 overflow-hidden rounded-md border bg-muted"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/90 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-2 text-xs"
          >
            <Paperclip className="mr-1 h-3.5 w-3.5" />
            Adjuntar foto
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Publicar
          </Button>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Cargando notas...
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-center">
          <StickyNote className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Aún no hay notas en este proyecto.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="group rounded-md border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserCircle2 className="h-4 w-4" />
                  <Badge variant="outline" className="text-[10px]">
                    {authorLabel(note)}
                  </Badge>
                  <span>{formatRelative(note.createdAt)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => setDeletingId(note.id)}
                  title="Eliminar nota"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {note.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
              )}
              {note.documents.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {note.documents.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => openNotePhoto(note, doc)}
                      className="group/photo relative h-20 w-20 overflow-hidden rounded-md border bg-muted transition-transform hover:scale-[1.02]"
                      title={doc.fileName}
                    >
                      <img src={doc.fileUrl} alt={doc.fileName} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/photo:bg-black/30">
                        <ImageIcon className="h-5 w-5 text-white opacity-0 transition-opacity group-hover/photo:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        title="Eliminar nota"
        description="¿Eliminar esta nota y sus fotos adjuntas? Esta acción no se puede deshacer."
      />
    </div>
  )
}
