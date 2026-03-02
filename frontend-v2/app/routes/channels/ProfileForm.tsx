import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import API from '~/lib/api';
import toast from '~/lib/toast';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '~/components/ui/field';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import Input from '~/components/dispatcharr/Input';
import { Badge } from '~/components/ui/badge';
import { X, InfoIcon } from 'lucide-react';
import useSettingsStore from '~/store/settings';
import { getChangedSettings, saveChangedSettings } from '~/lib/settings-utils';
import useChannelsStore from '~/store/channels';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';

interface AssignChannelNumbersFormProps {
  channelIds: number[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileForm({ isOpen, onClose, mode, profile }) {
  const [profileNameInput, setProfileNameInput] = useState('');
  const setSelectedProfileId = useChannelsStore((s) => s.setSelectedProfileId);

  useEffect(() => {
    if (isOpen && profile) {
      setProfileNameInput(
        mode === 'duplicate' ? `${profile.name} Copy` : profile.name
      );
    }
  }, [isOpen, mode, profile]);

  const closeModal = () => {
    setProfileNameInput('');
    onClose();
  };

  const submitProfileModal = async (e) => {
    e.preventDefault();

    const trimmedName = profileNameInput.trim();

    if (!mode || !profile) return;

    if (!trimmedName) {
      toast.show({
        title: 'Profile name is required',
        color: 'red.5',
      });
      return;
    }

    if (mode === 'edit') {
      if (trimmedName === profile.name) {
        closeModal();
        return;
      }

      const updatedProfile = await API.updateChannelProfile({
        id: profile.id,
        name: trimmedName,
      });

      if (updatedProfile) {
        toast.show({
          title: 'Profile renamed',
          message: `${profile.name} → ${trimmedName}`,
          color: 'green.5',
        });
        closeModal();
      }
    }

    if (mode === 'duplicate') {
      const duplicatedProfile = await API.duplicateChannelProfile(
        profile.id,
        trimmedName
      );

      if (duplicatedProfile) {
        toast.show({
          title: 'Profile duplicated',
          message: `${profile.name} copied to ${duplicatedProfile.name}`,
          color: 'green.5',
        });
        setSelectedProfileId(`${duplicatedProfile.id}`);
        closeModal();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'duplicate'
              ? `Duplicate Profile: ${profile?.name}`
              : `Rename Profile: ${profile?.name}`}
          </DialogTitle>
        </DialogHeader>

        <Alert className="bg-yellow-500/25">
          <InfoIcon />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            If you have any profile links (M3U, EPG, HDHR) shared with clients,
            they will need to be updated after renaming this profile.
          </AlertDescription>
        </Alert>

        <form onSubmit={submitProfileModal}>
          <div className="mb-4 mt-2">
            <Label htmlFor="profile-name">Profile Name</Label>
            <Input
              id="profile-name"
              value={profileNameInput}
              onChange={(e) => setProfileNameInput(e.target.value)}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              className="cursor-pointer"
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button className="cursor-pointer" type="submit">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
