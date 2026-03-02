import * as React from "react"
import { Upload, FileImage, X, File, CheckCircle2 } from "lucide-react"
import { cn } from "~/lib/utils"

export interface FileUploadProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop"> {
  /**
   * Callback when files are selected or dropped
   */
  onFilesSelected?: (files: File[]) => void
  onFilesCleared?: () => void
  /**
   * Maximum file size in bytes
   */
  maxSize?: number
  /**
   * Maximum number of files
   */
  maxFiles?: number
  /**
   * Accept specific file types (e.g., { 'image/*': ['.png', '.jpg'] })
   */
  accept?: Record<string, string[]>
  /**
   * Whether multiple files can be selected
   */
  multiple?: boolean
  /**
   * Whether the component is disabled
   */
  disabled?: boolean
  /**
   * Custom content to display in the upload area
   */
  children?: React.ReactNode
  /**
   * Show preview of selected files
   */
  showPreview?: boolean
  /**
   * Loading state
   */
  loading?: boolean
  /**
   * Error message to display
   */
  error?: string
}

const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  (
    {
      className,
      onFilesSelected,
      onFilesCleared,
      maxSize,
      maxFiles = 1,
      accept,
      multiple = false,
      disabled = false,
      children,
      showPreview = true,
      loading = false,
      error,
      ...props
    },
    ref
  ) => {
    const [isDragging, setIsDragging] = React.useState(false)
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
    const [validationError, setValidationError] = React.useState<string | null>(
      null
    )
    const inputRef = React.useRef<HTMLInputElement>(null)
    const dragCounterRef = React.useRef(0)

    // Convert accept object to HTML input accept string
    const acceptString = React.useMemo(() => {
      if (!accept) return undefined
      return Object.entries(accept)
        .flatMap(([mime, exts]) => [mime, ...exts])
        .join(",")
    }, [accept])

    const validateFiles = React.useCallback(
      (files: File[]): { valid: File[]; error: string | null } => {
        // Check max files
        if (files.length > maxFiles) {
          return {
            valid: [],
            error: `Maximum ${maxFiles} file${maxFiles > 1 ? "s" : ""} allowed`,
          }
        }

        // Check file size
        if (maxSize) {
          const oversizedFiles = files.filter((file) => file.size > maxSize)
          if (oversizedFiles.length > 0) {
            const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2)
            return {
              valid: [],
              error: `File size exceeds ${maxSizeMB}MB limit`,
            }
          }
        }

        // Check file types
        if (accept) {
          const validExtensions = Object.values(accept).flat()
          const validMimeTypes = Object.keys(accept)

          const invalidFiles = files.filter((file) => {
            const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`
            const fileMimeType = file.type

            const extensionMatch = validExtensions.some(
              (ext) => ext.toLowerCase() === fileExtension
            )
            const mimeMatch = validMimeTypes.some((mime) => {
              if (mime.endsWith("/*")) {
                const mimePrefix = mime.split("/")[0]
                return fileMimeType.startsWith(mimePrefix + "/")
              }
              return fileMimeType === mime
            })

            return !extensionMatch && !mimeMatch
          })

          if (invalidFiles.length > 0) {
            return {
              valid: [],
              error: "Invalid file type",
            }
          }
        }

        return { valid: files, error: null }
      },
      [maxSize, maxFiles, accept]
    )

    const handleFiles = React.useCallback(
      (files: FileList | null) => {
        if (!files || files.length === 0) return

        const fileArray = Array.from(files)
        const { valid, error } = validateFiles(fileArray)

        if (error) {
          setValidationError(error)
          setSelectedFiles([])
          return
        }

        setValidationError(null)
        setSelectedFiles(valid)
        onFilesSelected?.(valid)
      },
      [validateFiles, onFilesSelected]
    )

    const handleDragEnter = React.useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()

        if (disabled || loading) return

        dragCounterRef.current++
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          setIsDragging(true)
        }
      },
      [disabled, loading]
    )

    const handleDragLeave = React.useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()

        if (disabled || loading) return

        dragCounterRef.current--
        if (dragCounterRef.current === 0) {
          setIsDragging(false)
        }
      },
      [disabled, loading]
    )

    const handleDragOver = React.useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()

        if (disabled || loading) return

        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy"
        }
      },
      [disabled, loading]
    )

    const handleDrop = React.useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()

        if (disabled || loading) return

        setIsDragging(false)
        dragCounterRef.current = 0

        const files = e.dataTransfer.files
        handleFiles(files)
      },
      [disabled, loading, handleFiles]
    )

    const handleClick = React.useCallback(() => {
      if (disabled || loading) return
      inputRef.current?.click()
    }, [disabled, loading])

    const handleInputChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files)
        // Reset input value to allow selecting the same file again
        e.target.value = ""
      },
      [handleFiles]
    )

    const clearFiles = React.useCallback(() => {
      setSelectedFiles([])
      setValidationError(null)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
      onFilesCleared?.()
    }, [onFilesCleared])

    const displayError = error || validationError

    return (
      <div ref={ref} className="w-full space-y-2" {...props}>
        <div
          className={cn(
            "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-background p-6 transition-all",
            "hover:border-primary/50 hover:bg-accent/50",
            isDragging &&
              "border-primary bg-primary/5 dark:bg-primary/10 scale-[1.01]",
            disabled && "cursor-not-allowed opacity-50",
            loading && "cursor-wait opacity-70",
            displayError && "border-destructive bg-destructive/5",
            className
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={disabled || loading ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              handleClick()
            }
          }}
          aria-label="File upload area"
          aria-disabled={disabled || loading}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleInputChange}
            accept={acceptString}
            multiple={multiple}
            disabled={disabled || loading}
            aria-label="File input"
          />

          {children ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-center pointer-events-none">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </>
              ) : isDragging ? (
                <>
                  <Upload className="h-12 w-12 text-primary" />
                  <p className="text-sm font-medium text-primary">
                    Drop files here
                  </p>
                </>
              ) : selectedFiles.length > 0 ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="text-sm font-medium">
                    {selectedFiles.length} file
                    {selectedFiles.length > 1 ? "s" : ""} selected
                  </p>
                </>
              ) : (
                <>
                  <FileImage className="h-12 w-12 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="font-medium text-primary">
                      Click to upload
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      or drag and drop
                    </span>
                  </div>
                  {accept && (
                    <p className="text-xs text-muted-foreground">
                      {Object.values(accept)
                        .flat()
                        .join(", ")
                        .toUpperCase()}{" "}
                      files
                    </p>
                  )}
                  {maxSize && (
                    <p className="text-xs text-muted-foreground">
                      Max size: {(maxSize / (1024 * 1024)).toFixed(2)}MB
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {displayError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <X className="h-4 w-4" />
            <span>{displayError}</span>
          </div>
        )}

        {showPreview && selectedFiles.length > 0 && !displayError && (
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-md border border-input bg-background p-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {file.type.startsWith("image/") ? (
                    <FileImage className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <File className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="overflow-hidden">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>

<img
                  src={URL.createObjectURL(file)}
                  alt="Logo preview"
                  width={100}
                  height={75}
                  style={{
                    objectFit: 'contain',
                    transition: 'transform 0.3s ease',
                    cursor: 'pointer',
                    ':hover': {
                      transform: 'scale(1.5)',
                    },
                  }}
                  onError={(e) => {
                    e.target.src = '/logo.png';
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                  }}
                />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearFiles()
                  }}
                  className="shrink-0 rounded-md p-1 hover:bg-destructive/10 text-destructive"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)

FileUpload.displayName = "FileUpload"

export { FileUpload }
