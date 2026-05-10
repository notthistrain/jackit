import { ref } from 'vue'
import { toast } from 'vue-sonner'

export interface AsyncButtonOptions {
  minDuration?: number
  onSuccess?: (result: any) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
  loadingMessage?: string
}

export function useAsyncButton<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: AsyncButtonOptions = {},
) {
  const {
    minDuration = 500,
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    loadingMessage,
  } = options

  const loading = ref(false)

  const execute = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined> => {
    loading.value = true
    const startTime = Date.now()

    if (loadingMessage) {
      toast.info(loadingMessage)
    }

    try {
      const result = await fn(...args)

      if (successMessage) {
        toast.success(successMessage)
      }

      onSuccess?.(result)
      return result
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const message = errorMessage || error.message

      toast.error('操作失败', { description: message })
      onError?.(error)
      throw error
    }
    finally {
      const elapsed = Date.now() - startTime
      if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed))
      }
      loading.value = false
    }
  }

  return {
    loading,
    execute,
  }
}
