import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import API from '@/lib/api';
import { CircleCheck, SquarePlus } from 'lucide-react';
import React, { useState } from 'react';

const CreateProfilePopover = React.memo(() => {
  const [name, setName] = useState('');
  const [opened, setOpened] = useState(false);

  const setOpen = () => {
    setName('');
    setOpened(!opened);
  };

  const submit = async () => {
    await API.addChannelProfile({ name });
    setName('');
    setOpened(false);
  };

  return (
    <Popover open={opened} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SquarePlus size={24} />
      </PopoverTrigger>
      <PopoverContent className="p-2">
        <div className="flex items-center">
          <Input
            placeholder="Profile name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div
            className="cursor-pointer ml-2 text-[var(--success)]"
            onClick={submit}
          >
            <CircleCheck size={20} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default CreateProfilePopover;
