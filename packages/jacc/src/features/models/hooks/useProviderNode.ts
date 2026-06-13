import { useState } from 'react'
import { useApiKeys } from '@/features/models/hooks/useApiKeys'

export function useProviderNode(providerId: number) {
  const { apiKeys, update, remove, add } = useApiKeys(providerId)
  const [expanded, setExpanded] = useState(false)
  const [showAddKey, setShowAddKey] = useState(false)
  const [showEditProvider, setShowEditProvider] = useState(false)
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState(false)

  async function handleAddKey(input: { provider_id: number, name: string, api_key: string, notes: string | null }) {
    await add(input)
    setShowAddKey(false)
  }

  return {
    apiKeys,
    update,
    remove,
    expanded,
    showAddKey,
    showEditProvider,
    confirmDeleteProvider,
    setExpanded,
    setShowAddKey,
    setShowEditProvider,
    setConfirmDeleteProvider,
    handleAddKey,
  }
}
