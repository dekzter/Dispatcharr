import React, {useState} from 'react';
import useAuthStore from '~/store/auth';
import API from '~/lib/api';
import { CircleCheck, SquarePlus } from 'lucide-react';
import { USER_LEVELS } from '~/lib/constants';
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '~/components/ui/popover';
import { Input } from '~/components/ui/input';

const CreateProfilePopover = React.memo(() => {
  const [name, setName] = useState('');
  const [opened, setOpened] = useState(false)

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
    <Popover
    open={opened}
        onOpenChange={setOpen}
    >
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
        className="cursor-pointer ml-2 text-green-500"
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
