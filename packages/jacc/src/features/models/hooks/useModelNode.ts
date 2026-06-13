import { useState } from 'react'

export function useModelNode() {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return { confirmDelete, setConfirmDelete }
}
