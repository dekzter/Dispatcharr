import { FileUpload } from '@/components/dispatcharr/file-upload';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import API from '@/lib/api';
import toast from '@/lib/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';

const schema = Yup.object({
  name: Yup.string().required('Name is required'),
  url: Yup.string()
    .required('URL is required')
    .test(
      'valid-url-or-path',
      'Must be a valid URL or local file path',
      (value) => {
        console.log(value);
        if (!value) return false;
        // Allow local file paths starting with /data/logos/
        if (value.startsWith('/data/logos/')) return true;
        // Allow valid URLs
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      }
    ),
});

const LogoForm = ({ logo = null, isOpen, onClose, onSuccess }) => {
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // Store selected file

  const defaultValues = useMemo(
    () => ({
      name: logo?.name || '',
      url: logo?.url || '',
    }),
    [logo]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm({
    defaultValues,
    resolver: yupResolver(schema),
  });

  const onSubmit = async (values) => {
    try {
      setUploading(true);
      let uploadResponse = null; // Store upload response for later use

      // If we have a selected file, upload it first
      if (selectedFile) {
        try {
          uploadResponse = await API.uploadLogo(selectedFile, values.name);
          // Use the uploaded file data instead of form values
          values.name = uploadResponse.name;
          values.url = uploadResponse.url;
        } catch (uploadError) {
          let errorMessage = 'Failed to upload logo file';

          if (
            uploadError.code === 'NETWORK_ERROR' ||
            uploadError.message?.includes('timeout')
          ) {
            errorMessage = 'Upload timed out. Please try again.';
          } else if (uploadError.status === 413) {
            errorMessage = 'File too large. Please choose a smaller file.';
          } else if (uploadError.body?.error) {
            errorMessage = uploadError.body.error;
          }

          toast.show({
            title: 'Upload Error',
            message: errorMessage,
            color: 'red',
          });
          return; // Don't proceed with creation if upload fails
        }
      }

      // Now create or update the logo with the final values
      // Only proceed if we don't already have a logo from file upload
      if (logo) {
        const updatedLogo = await API.updateLogo(logo.id, values);
        toast.show({
          title: 'Success',
          message: 'Logo updated successfully',
          color: 'green',
        });
        onSuccess?.({ type: 'update', logo: updatedLogo }); // Call onSuccess for updates
      } else if (!selectedFile) {
        // Only create a new logo entry if we're not uploading a file
        // (file upload already created the logo entry)
        const newLogo = await API.createLogo(values);
        toast.show({
          title: 'Success',
          message: 'Logo created successfully',
          color: 'green',
        });
        onSuccess?.({ type: 'create', logo: newLogo }); // Call onSuccess for creates
      } else {
        // File was uploaded and logo was already created
        toast.show({
          title: 'Success',
          message: 'Logo uploaded successfully',
          color: 'green',
        });
        onSuccess?.({ type: 'create', logo: uploadResponse });
      }
      onClose();
    } catch (error) {
      let errorMessage = logo
        ? 'Failed to update logo'
        : 'Failed to create logo';

      // Handle specific timeout errors
      if (
        error.code === 'NETWORK_ERROR' ||
        error.message?.includes('timeout')
      ) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      toast.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    reset(defaultValues);
    setLogoPreview(logo?.cache_url || null);
    setSelectedFile(null);
  }, [defaultValues, logo, reset]);

  const handleFileSelect = (files) => {
    if (files.length === 0) return;

    const file = files[0];

    // Validate file size on frontend first
    if (file.size > 5 * 1024 * 1024) {
      // 5MB
      toast.show({
        title: 'Error',
        message: 'File too large. Maximum size is 5MB.',
        color: 'red',
      });
      return;
    }

    // Store the file for later upload and create preview
    setSelectedFile(file);

    // Generate a local preview URL
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);

    // Auto-fill the name field if empty
    const currentName = watch('name');
    if (!currentName) {
      const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
      setValue('name', nameWithoutExtension);
    }

    // Set a placeholder URL (will be replaced after upload)
    setValue('url', 'file://pending-upload');
  };

  const handleUrlChange = (event) => {
    const url = event.target.value;
    setValue('url', url);

    // Clear any selected file when manually entering URL
    if (selectedFile) {
      setSelectedFile(null);
      // Revoke the object URL to free memory
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    }

    // Update preview for remote URLs
    if (url && url.startsWith('http')) {
      setLogoPreview(url);
    } else if (!url) {
      setLogoPreview(null);
    }
  };

  const handleUrlBlur = (event) => {
    const urlValue = event.target.value;
    if (urlValue) {
      try {
        const url = new URL(urlValue);
        const pathname = url.pathname;
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
        const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
        if (nameWithoutExtension) {
          setValue('name', nameWithoutExtension);
        }
      } catch (error) {
        // If the URL is invalid, do nothing.
        // The validation schema will catch this.
      }
    }
  };

  // Clean up object URLs when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {logo ? 'Edit Logo' : 'Add Logo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4 overflow-y-auto px-1">
            {/* Logo Preview */}
            {logoPreview && (
              <div className="flex flex-col justify-center items-center">
                Preview
                <img
                  src={logoPreview}
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
              </div>
            )}

            {/* File Upload */}
            <div>
              <div className="font-semibold">Upload Logo File</div>

              <FileUpload
                maxFiles={1}
                multiple={false}
                accept={{
                  'image/*': [
                    '.png',
                    '.jpg',
                    '.jpeg',
                    '.gif',
                    '.webp',
                    '.bmp',
                    '.svg',
                  ],
                }}
                maxSize={5 * 1024 * 1024} // 5MB
                disabled={uploading}
                onFilesSelected={handleFileSelect}
                showPreview={true}
                onFilesCleared={() => setLogoPreview(null)}
              />
            </div>

            <div className="w-full">
              <div className="relative flex items-center gap-2">
                <Separator className="flex-1" />
                <span className="shrink-0 pr-2 text-xs text-muted-foreground">
                  OR
                </span>
                <Separator className="flex-1" />
              </div>
            </div>

            {/* Manual URL Input */}
            <Field>
              <FieldLabel htmlFor="logo-url">Logo URL</FieldLabel>
              <Input
                id="logo-url"
                placeholder="https://example.com/logo.png"
                {...register('url')}
                onChange={handleUrlChange}
                onBlur={handleUrlBlur}
                aria-invalid={!!errors.url}
                disabled={!!selectedFile} // Disable when file is selected
              />
              <FieldError>{errors.url?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="name">Logo Name</FieldLabel>
              <Input
                id="name"
                placeholder="Enter logo name"
                {...register('name')}
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {logo ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LogoForm;
