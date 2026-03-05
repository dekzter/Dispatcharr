import ConfirmationDialog from '@/components/ConfirmationDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import API from '@/lib/api';
import toast from '@/lib/toast';
import useChannelsStore from '@/store/channels';
import useWarningsStore from '@/store/warnings';
import {
  Check,
  Database,
  Filter,
  Info,
  SquareMinus,
  SquarePen,
  Tv,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// Move GroupItem outside to prevent recreation on every render
const GroupItem = React.memo(
  ({
    group,
    editingGroup,
    editName,
    onEditNameChange,
    onSaveEdit,
    onCancelEdit,
    onEdit,
    onDelete,
    groupUsage,
    canEditGroup,
    canDeleteGroup,
  }) => {
    const getGroupBadges = (group) => {
      const usage = groupUsage[group.id];
      const badges = [];

      if (usage?.hasChannels) {
        badges.push(
          <Badge key="channels" className="bg-blue-500/20 text-blue-500">
            <Tv size={10} />
            Channels
          </Badge>
        );
      }

      if (usage?.hasM3UAccounts) {
        badges.push(
          <Badge key="m3u" className="bg-purple-500/20 text-purple-500">
            <Database size={10} />
            M3U
          </Badge>
        );
      }

      return badges.length > 0 ? (
        <div className="flex mt-1 gap-1">{badges}</div>
      ) : (
        <></>
      );
    };

    return (
      <Card className="p-2 px-2">
        <CardContent className="flex justify-between">
          <div className="flex flex-col justify-center">
            {editingGroup === group.id ? (
              <Input
                value={editName}
                onChange={onEditNameChange}
                onKeyDown={(e) => e.key === 'Enter' && onSaveEdit()}
                autoFocus
              />
            ) : (
              group.name
            )}

            {getGroupBadges(group)}
          </div>

          <div>
            {editingGroup === group.id ? (
              <div className="flex justify-end">
                <Button variant="ghost" className="px-1" onClick={onSaveEdit}>
                  <Check className="text-[var(--success)]" />
                </Button>
                <Button variant="ghost" className="px-1" onClick={onCancelEdit}>
                  <X className="text-[var(--destructive)]" />
                </Button>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  className="px-1"
                  variant="ghost"
                  onClick={() => onEdit(group)}
                  disabled={!canEditGroup(group)}
                >
                  <SquarePen className="text-[var(--warning)]" />
                </Button>
                <Button
                  className="px-1"
                  variant="ghost"
                  onClick={() => onDelete(group)}
                  disabled={!canDeleteGroup(group)}
                >
                  <SquareMinus className="text-[var(--success)]" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

const GroupManager = React.memo(({ isOpen, onClose }) => {
  const channelGroups = useChannelsStore((s) => s.channelGroups);
  const canEditChannelGroup = useChannelsStore((s) => s.canEditChannelGroup);
  const canDeleteChannelGroup = useChannelsStore(
    (s) => s.canDeleteChannelGroup
  );
  const isWarningSuppressed = useWarningsStore((s) => s.isWarningSuppressed);
  const suppressWarning = useWarningsStore((s) => s.suppressWarning);

  const [editingGroup, setEditingGroup] = useState(null);
  const [editName, setEditName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [groupUsage, setGroupUsage] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [showChannelGroups, setShowChannelGroups] = useState(true);
  const [showM3UGroups, setShowM3UGroups] = useState(true);
  const [showUnusedGroups, setShowUnusedGroups] = useState(true);

  // Confirmation dialog states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Memoize the channel groups array to prevent unnecessary re-renders
  const channelGroupsArray = useMemo(
    () => Object.values(channelGroups),
    [channelGroups]
  );

  // Memoize sorted groups to prevent re-sorting on every render
  const sortedGroups = useMemo(
    () => channelGroupsArray.sort((a, b) => a.name.localeCompare(b.name)),
    [channelGroupsArray]
  );

  // Filter groups based on search term and chip filters
  const filteredGroups = useMemo(() => {
    let filtered = sortedGroups;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter((group) =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply chip filters
    filtered = filtered.filter((group) => {
      const usage = groupUsage[group.id];
      if (!usage) return false;

      const hasChannels = usage.hasChannels;
      const hasM3U = usage.hasM3UAccounts;
      const isUnused = !hasChannels && !hasM3U;

      // If group is unused, only show if unused groups are enabled
      if (isUnused) {
        return showUnusedGroups;
      }

      // For groups with channels and/or M3U, show if either filter is enabled
      let shouldShow = false;
      if (hasChannels && showChannelGroups) shouldShow = true;
      if (hasM3U && showM3UGroups) shouldShow = true;

      return shouldShow;
    });

    return filtered;
  }, [
    sortedGroups,
    searchTerm,
    showChannelGroups,
    showM3UGroups,
    showUnusedGroups,
    groupUsage,
  ]);

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const counts = {
      channels: 0,
      m3u: 0,
      unused: 0,
    };

    sortedGroups.forEach((group) => {
      const usage = groupUsage[group.id];
      if (usage) {
        const hasChannels = usage.hasChannels;
        const hasM3U = usage.hasM3UAccounts;

        // Count groups with channels (including those with both)
        if (hasChannels) {
          counts.channels++;
        }

        // Count groups with M3U (including those with both)
        if (hasM3U) {
          counts.m3u++;
        }

        // Count truly unused groups
        if (!hasChannels && !hasM3U) {
          counts.unused++;
        }
      }
    });

    return counts;
  }, [sortedGroups, groupUsage]);

  const fetchGroupUsage = useCallback(async () => {
    setLoading(true);
    try {
      // Use the actual channel group data that already has the flags
      const usage = {};

      Object.values(channelGroups).forEach((group) => {
        usage[group.id] = {
          hasChannels: group.hasChannels ?? false,
          hasM3UAccounts: group.hasM3UAccounts ?? false,
          canEdit: group.canEdit ?? true,
          canDelete: group.canDelete ?? true,
        };
      });

      setGroupUsage(usage);
    } catch (error) {
      console.error('Error fetching group usage:', error);
    } finally {
      setLoading(false);
    }
  }, [channelGroups]);

  // Fetch group usage information when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchGroupUsage();
    }
  }, [isOpen, fetchGroupUsage]);

  const handleEdit = useCallback((group) => {
    setEditingGroup(group.id);
    setEditName(group.name);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editName.trim()) {
      toast.show({
        title: 'Error',
        message: 'Group name cannot be empty',
        color: 'red',
      });
      return;
    }

    try {
      await API.updateChannelGroup({
        id: editingGroup,
        name: editName.trim(),
      });

      toast.show({
        title: 'Success',
        message: 'Group updated successfully',
        color: 'green',
      });

      setEditingGroup(null);
      setEditName('');
      await fetchGroupUsage(); // Refresh usage data
    } catch (error) {
      toast.show({
        title: 'Error',
        message: 'Failed to update group',
        color: 'red',
      });
    }
  }, [editName, editingGroup, fetchGroupUsage]);

  const handleCancelEdit = useCallback(() => {
    setEditingGroup(null);
    setEditName('');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newGroupName.trim()) {
      toast.show({
        title: 'Error',
        message: 'Group name cannot be empty',
        color: 'red',
      });
      return;
    }

    try {
      await API.addChannelGroup({
        name: newGroupName.trim(),
      });

      toast.show({
        title: 'Success',
        message: 'Group created successfully',
        color: 'green',
      });

      setNewGroupName('');
      setIsCreating(false);
      await fetchGroupUsage(); // Refresh usage data
    } catch (error) {
      toast.show({
        title: 'Error',
        message: 'Failed to create group',
        color: 'red',
      });
    }
  }, [newGroupName, fetchGroupUsage]);

  const executeDeleteGroup = useCallback(
    async (group) => {
      setDeletingGroup(true);
      try {
        await API.deleteChannelGroup(group.id);

        toast.show({
          title: 'Success',
          message: 'Group deleted successfully',
          color: 'green',
        });

        await fetchGroupUsage(); // Refresh usage data
      } catch (error) {
        toast.show({
          title: 'Error',
          message: 'Failed to delete group',
          color: 'red',
        });
      } finally {
        setDeletingGroup(false);
        setConfirmDeleteOpen(false);
      }
    },
    [fetchGroupUsage]
  );

  const handleDelete = useCallback(
    async (group) => {
      const usage = groupUsage[group.id];

      if (
        usage &&
        (!usage.canDelete || usage.hasChannels || usage.hasM3UAccounts)
      ) {
        toast.show({
          title: 'Cannot Delete',
          message:
            'This group is associated with channels or M3U accounts and cannot be deleted',
          color: 'orange',
        });
        return;
      }

      // Store group for confirmation dialog
      setGroupToDelete(group);

      // Skip warning if it's been suppressed
      if (isWarningSuppressed('delete-group')) {
        return executeDeleteGroup(group);
      }

      setConfirmDeleteOpen(true);
    },
    [groupUsage, isWarningSuppressed, executeDeleteGroup]
  );

  const executeCleanup = useCallback(async () => {
    setIsCleaningUp(true);
    try {
      const result = await API.cleanupUnusedChannelGroups();

      toast.show({
        title: 'Cleanup Complete',
        message: `Successfully deleted ${result.deleted_count} unused groups`,
        color: 'green',
      });

      await fetchGroupUsage(); // Refresh usage data
      setConfirmCleanupOpen(false);
    } catch (error) {
      toast.show({
        title: 'Cleanup Failed',
        message: 'Failed to cleanup unused groups',
        color: 'red',
      });
      setConfirmCleanupOpen(false);
    } finally {
      setIsCleaningUp(false);
    }
  }, [fetchGroupUsage]);

  const handleCleanup = useCallback(async () => {
    // Skip warning if it's been suppressed
    if (isWarningSuppressed('cleanup-groups')) {
      return executeCleanup();
    }

    setConfirmCleanupOpen(true);
  }, [isWarningSuppressed, executeCleanup]);

  const handleNewGroupNameChange = useCallback((e) => {
    setNewGroupName(e.target.value);
  }, []);

  const handleEditNameChange = useCallback((e) => {
    setEditName(e.target.value);
  }, []);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="flex flex-col max-h-[90vh] sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Group Manager</DialogTitle>
          </DialogHeader>

          <Alert className="bg-[var(--info)]/20">
            <Info />
            <AlertDescription>
              Manage channel groups. Groups associated with M3U accounts or
              containing channels cannot be deleted.
            </AlertDescription>
          </Alert>

          {isCreating ? (
            <div className="flex space-between gap-2">
              <Input
                placeholder="Enter group name"
                value={newGroupName}
                onChange={handleNewGroupNameChange}
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />

              <Button onClick={handleCreate}>
                <Check />
              </Button>

              <Button
                variant="destructive"
                onClick={() => {
                  setIsCreating(false);
                  setNewGroupName('');
                }}
              >
                <X />
              </Button>
            </div>
          ) : (
            <div className="flex justify-between">
              <Button
                className="cursor-pointer"
                onClick={() => setIsCreating(true)}
              >
                Add Group
              </Button>

              <Button
                className="cursor-pointer"
                variant="destructive"
                onClick={handleCleanup}
                disabled={isCleaningUp}
              >
                {isCleaningUp ? 'Cleaning Up...' : 'Cleanup Unused'}
              </Button>
            </div>
          )}

          <Separator className="my-2" />

          <div className="flex justify-between">
            <div class="flex items-center gap-2">
              <Filter size={16} className="mb-1" />
              Filter Groups
            </div>

            <Input
              placeholder="Search groups..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="max-w-[200px]"
            />
          </div>

          <div className="flex items-center text-xs font-light justify-between gap-2">
            {/* <div>Show:</div> */}
            <Toggle
              className="cursor-pointer data-[state=on]:bg-blue-500 data-[state=off]:bg-zinc-500"
              pressed={showChannelGroups}
              onPressedChange={setShowChannelGroups}
            >
              <Tv size={12} /> Channel Groups ({filterCounts.channels})
            </Toggle>
            <Toggle
              pressed={showM3UGroups}
              onPressedChange={setShowM3UGroups}
              className="cursor-pointer data-[state=on]:bg-purple-500 data-[state=off]:bg-zinc-500"
            >
              <Database size={10} />
              M3U Groups ({filterCounts.m3u})
            </Toggle>
            <Toggle
              variant="outline"
              pressed={showUnusedGroups}
              onPressedChange={setShowUnusedGroups}
              className="cursor-pointer"
            >
              Unused Groups ({filterCounts.unused})
            </Toggle>
          </div>

          <div>
            Groups ({filteredGroups.length}
            {(searchTerm ||
              !showChannelGroups ||
              !showM3UGroups ||
              !showUnusedGroups) &&
              ` of ${sortedGroups.length}`}
            )
          </div>
          <Separator className="my-2" />

          <div className="-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4">
            {loading ? (
              <div className="text-sm text-gray-500">
                Loading group information...
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    editingGroup={editingGroup}
                    editName={editName}
                    onEditNameChange={handleEditNameChange}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    groupUsage={groupUsage}
                    canEditGroup={canEditChannelGroup}
                    canDeleteGroup={canDeleteChannelGroup}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        opened={confirmCleanupOpen}
        onClose={() => setConfirmCleanupOpen(false)}
        onConfirm={executeCleanup}
        loading={isCleaningUp}
        title="Confirm Group Cleanup"
        message={
          <div style={{ whiteSpace: 'pre-line' }}>
            {`Are you sure you want to cleanup all unused groups?

    This will permanently delete all groups that are not associated with any channels or M3U accounts.

    This action cannot be undone.`}
          </div>
        }
        confirmLabel="Cleanup"
        cancelLabel="Cancel"
        actionKey="cleanup-groups"
        onSuppressChange={suppressWarning}
        size="md"
        zIndex={2100}
      />
    </>
  );
});

export default GroupManager;
