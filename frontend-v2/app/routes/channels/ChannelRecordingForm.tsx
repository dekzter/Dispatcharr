import API from '@/lib/api';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
// import { DateTimePicker, TimeInput, DatePickerInput } from '@mantine/dates';
import { SearchableInput } from '@/components/dispatcharr/searchable-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FieldGroup,
} from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import toast from '@/lib/toast';
import useChannelsStore from '@/store/channels';
import { yupResolver } from '@hookform/resolvers/yup';
import { ChevronDown, Info } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const DAY_OPTIONS = [
  { value: '6', label: 'Sun' },
  { value: '0', label: 'Mon' },
  { value: '1', label: 'Tue' },
  { value: '2', label: 'Wed' },
  { value: '3', label: 'Thu' },
  { value: '4', label: 'Fri' },
  { value: '5', label: 'Sat' },
];

const asDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoIfDate = (value) => {
  const dt = asDate(value);
  return dt ? dt.toISOString() : value;
};

// Accepts "h:mm A"/"hh:mm A"/"HH:mm"/Date, returns "HH:mm"
const toTimeString = (value) => {
  if (!value) return '00:00';
  if (typeof value === 'string') {
    const parsed = dayjs(
      value,
      ['HH:mm', 'hh:mm A', 'h:mm A', 'HH:mm:ss'],
      true
    );
    if (parsed.isValid()) return parsed.format('HH:mm');
    return value;
  }
  const dt = asDate(value);
  if (!dt) return '00:00';
  return dayjs(dt).format('HH:mm');
};

const toDateString = (value) => {
  const dt = asDate(value);
  if (!dt) return null;
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createRoundedDate = (minutesAhead = 0) => {
  const dt = new Date();
  dt.setSeconds(0);
  dt.setMilliseconds(0);
  dt.setMinutes(Math.ceil(dt.getMinutes() / 30) * 30);
  if (minutesAhead) dt.setMinutes(dt.getMinutes() + minutesAhead);
  return dt;
};

// robust onChange for TimeInput (string or event)
const timeChange = (setter) => (valOrEvent) => {
  if (typeof valOrEvent === 'string') setter(valOrEvent);
  else if (valOrEvent?.currentTarget) setter(valOrEvent.currentTarget.value);
};

const singleSchema = Yup.object({
  channel_id: Yup.string().required('Channel is required'),
  start_time: Yup.string()
    .required('Start time is required')
    .test('is-valid-date', 'Start time is invalid', (value) =>
      dayjs(value).isValid()
    ),
  end_time: Yup.string()
    .required('End time is required')
    .test('is-valid-date', 'End time is invalid', (value) =>
      dayjs(value).isValid()
    )
    .test('after-start', 'End time must be after start time', function (value) {
      const { start_time } = this.parent;
      if (!start_time || !value) return true;
      return dayjs(value).isAfter(dayjs(start_time));
    }),
});

const recurringSchema = Yup.object({
  channel_id: Yup.string().required('Channel is required'),
  rule_name: Yup.string(),
  days_of_week: Yup.array()
    .of(Yup.string())
    .min(1, 'Select at least one day')
    .required('Select at least one day'),
  start_date: Yup.string()
    .required('Start date is required')
    .test('is-valid-date', 'Start date is invalid', (value) =>
      dayjs(value, 'YYYY-MM-DD', true).isValid()
    ),
  end_date: Yup.string()
    .required('End date is required')
    .test('is-valid-date', 'End date is invalid', (value) =>
      dayjs(value, 'YYYY-MM-DD', true).isValid()
    )
    .test(
      'not-before-start',
      'End date cannot be before start date',
      function (value) {
        const { start_date } = this.parent;
        if (!start_date || !value) return true;
        return !dayjs(value).isBefore(dayjs(start_date));
      }
    ),
  start_time: Yup.string()
    .required('Start time is required')
    .matches(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  end_time: Yup.string()
    .required('End time is required')
    .matches(/^\d{2}:\d{2}$/, 'Use HH:MM format')
    .test(
      'differs-from-start',
      'End time must differ from start time',
      function (value) {
        const { start_time } = this.parent;
        if (!start_time || !value) return true;
        return value !== start_time;
      }
    ),
});

const ChannelRecordingForm = ({
  recording = null,
  channel = null,
  isOpen,
  onClose,
}) => {
  const fetchRecordings = useChannelsStore((s) => s.fetchRecordings);
  const fetchRecurringRules = useChannelsStore((s) => s.fetchRecurringRules);

  const [channelLabel, setChannelLabel] = useState('');

  // All channels loaded via lightweight summary API
  const [allChannels, setAllChannels] = useState([]);
  const [isChannelsLoading, setIsChannelsLoading] = useState(false);

  const [mode, setMode] = useState('single');
  const [activeTab, setActiveTab] = useState<'single' | 'recurring'>('single');
  const [submitting, setSubmitting] = useState(false);

  const defaultStart = createRoundedDate();
  const defaultEnd = createRoundedDate(60);
  const defaultDate = new Date();

  //     const {
  //     control,
  //     handleSubmit,
  //     formState: { errors, isSubmitting },
  //     reset,
  //   } = useForm({
  const singleForm = useForm({
    resolver: yupResolver(singleSchema),
    defaultValues: {
      channel_id: recording
        ? `${recording.channel}`
        : channel
          ? `${channel.id}`
          : '',
      start_time: recording
        ? asDate(recording.start_time) || defaultStart
        : defaultStart,
      end_time: recording
        ? asDate(recording.end_time) || defaultEnd
        : defaultEnd,
    },
  });

  //     const {
  //     control,
  //     handleSubmit,
  //     watch,
  //     formState: { errors, isSubmitting },
  //     reset,
  //   } = useForm({
  const recurringForm = useForm({
    resolver: yupResolver(recurringSchema),
    defaultValues: {
      channel_id: channel ? `${channel.id}` : '',
      days_of_week: [],
      start_time: dayjs(defaultStart).format('HH:mm'),
      end_time: dayjs(defaultEnd).format('HH:mm'),
      rule_name: '',
      start_date: dayjs(defaultDate).format('YYYY-MM-DD'),
      end_date: dayjs(defaultDate).format('YYYY-MM-DD'),
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    const freshStart = createRoundedDate();
    const freshEnd = createRoundedDate(60);
    const freshDate = new Date();

    if (recording && recording.id) {
      setMode('single');
      singleForm.reset({
        channel_id: `${recording.channel}`,
        start_time: asDate(recording.start_time) || defaultStart,
        end_time: asDate(recording.end_time) || defaultEnd,
      });
    } else {
      // Reset forms for fresh open
      singleForm.reset({
        channel_id: channel ? `${channel.id}` : '',
        start_time: freshStart,
        end_time: freshEnd,
      });

      const startStr = dayjs(freshStart).format('HH:mm');
      recurringForm.reset({
        channel_id: channel ? `${channel.id}` : '',
        days_of_week: [],
        start_time: startStr,
        end_time: dayjs(freshEnd).format('HH:mm'),
        rule_name: channel?.name || '',
        start_date: dayjs(freshDate).format('YYYY-MM-DD'),
        end_date: dayjs(freshDate).format('YYYY-MM-DD'),
      });
      setMode('single');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, recording, channel]);

  // Load all channels via lightweight summary API when modal opens
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOpen) return;
      try {
        setIsChannelsLoading(true);
        const chans = await API.getChannelsSummary();
        if (cancelled) return;
        setAllChannels(Array.isArray(chans) ? chans : []);
      } catch (e) {
        console.warn('Failed to load channels for recording form', e);
        if (!cancelled) setAllChannels([]);
      } finally {
        if (!cancelled) setIsChannelsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const channelOptions = useMemo(() => {
    const list = Array.isArray(allChannels) ? [...allChannels] : [];
    list.sort((a, b) => {
      const aNum = Number(a.channel_number) || 0;
      const bNum = Number(b.channel_number) || 0;
      if (aNum === bNum) return (a.name || '').localeCompare(b.name || '');
      return aNum - bNum;
    });
    return list.map((item) => ({
      value: `${item.id}`,
      label: item.channel_number
        ? `${item.channel_number} - ${item.name || `Channel ${item.id}`}`
        : item.name || `Channel ${item.id}`,
    }));
  }, [allChannels]);

  const resetForms = () => {
    singleForm.reset();
    recurringForm.reset();
    setChannelLabel('');
    setMode('single');
  };

  const handleClose = () => {
    resetForms();
    onClose?.();
  };

  const handleSingleSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (recording && recording.id) {
        await API.updateRecording(recording.id, {
          channel: values.channel_id,
          start_time: toIsoIfDate(values.start_time),
          end_time: toIsoIfDate(values.end_time),
        });
        toast.show({
          title: 'Recording updated',
          message: 'Recording schedule updated successfully',
          color: 'green',
          autoClose: 2500,
        });
      } else {
        await API.createRecording({
          channel: values.channel_id,
          start_time: toIsoIfDate(values.start_time),
          end_time: toIsoIfDate(values.end_time),
        });
        toast.show({
          title: 'Recording scheduled',
          message: 'One-time recording added to DVR queue',
          color: 'green',
          autoClose: 2500,
        });
      }
      await fetchRecordings();
      handleClose();
    } catch (error) {
      console.error('Failed to create recording', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecurringSubmit = async (values) => {
    try {
      setSubmitting(true);
      await API.createRecurringRule({
        channel: values.channel_id,
        days_of_week: (values.days_of_week || []).map((d) => Number(d)),
        start_time: toTimeString(values.start_time),
        end_time: toTimeString(values.end_time),
        start_date: toDateString(values.start_date),
        end_date: toDateString(values.end_date),
        name: values.rule_name?.trim() || '',
      });

      await Promise.all([fetchRecurringRules(), fetchRecordings()]);
      toast.show({
        title: 'Recurring rule saved',
        message: 'Future slots will be scheduled automatically',
        color: 'green',
        autoClose: 2500,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to create recurring rule', error);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit =
    mode === 'single'
      ? singleForm.handleSubmit(handleSingleSubmit)
      : recurringForm.handleSubmit(handleRecurringSubmit);

  useEffect(() => {
    if (!channel) {
      setChannelLabel('');
      return;
    }
    const match = channelOptions.find((opt) => opt.value === `${channel.id}`);
    setChannelLabel(match?.label ?? channel.name ?? '');
  }, [channel, channelOptions]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Channel Recording</DialogTitle>
        </DialogHeader>

        <Alert className="bg-yellow-500/25">
          <Info />
          <AlertTitle>Scheduling Conflicts</AlertTitle>
          <AlertDescription>
            Recordings may fail if active streams or overlapping recordings use
            up all available tuners.
          </AlertDescription>
        </Alert>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'single' | 'recurring')}
        >
          <TabsList className="w-full">
            <TabsTrigger value="single">One-Time</TabsTrigger>
            <TabsTrigger value="recurring">Recurring</TabsTrigger>
          </TabsList>
          <TabsContent value="single">
            <form
              id="single-form"
              onSubmit={singleForm.handleSubmit(handleSingleSubmit)}
            >
              <div className="gap-4 flex flex-col">
                <FieldGroup>
                  <Controller
                    name="channel_id"
                    control={singleForm.control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Channel</Label>
                        <SearchableInput
                          {...field}
                          label="Channel"
                          placeholder={channelLabel || 'Select channel'}
                          allowMultiple={false}
                          autoFocus={false}
                          options={channelOptions}
                          onSelect={(value) => {
                            setChannelLabel(value.label);
                            singleForm.setValue('channel_id', value.value, {
                              shouldValidate: true,
                            });
                          }}
                        />
                        {singleForm.formState.errors.channel_id && (
                          <p className="text-sm text-destructive">
                            {
                              singleForm.formState.errors.channel_id
                                .message as string
                            }
                          </p>
                        )}
                      </div>
                    )}
                  />
                </FieldGroup>

                <FieldGroup>
                  <Controller
                    name="start_time"
                    control={singleForm.control}
                    render={({ field }) => {
                      const dateVal = asDate(field.value);
                      return (
                        <div className="space-y-1">
                          <Label>Start</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                                data-empty={!dateVal ? true : undefined}
                              >
                                {dateVal
                                  ? dayjs(dateVal).format('MMM D, YYYY h:mm A')
                                  : 'Select start date & time'}
                                <ChevronDown />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={dateVal ?? undefined}
                                onSelect={(date) => {
                                  if (!date) return;
                                  // Preserve existing time when only the date changes
                                  const prev = asDate(field.value);
                                  if (prev) {
                                    date.setHours(
                                      prev.getHours(),
                                      prev.getMinutes(),
                                      0,
                                      0
                                    );
                                  }
                                  field.onChange(date);
                                }}
                              />
                              <div className="border-t p-3">
                                <input
                                  type="time"
                                  className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                                  value={
                                    dateVal
                                      ? dayjs(dateVal).format('HH:mm')
                                      : ''
                                  }
                                  onChange={(e) => {
                                    const [h, m] = e.target.value
                                      .split(':')
                                      .map(Number);
                                    const next = dateVal
                                      ? new Date(dateVal)
                                      : new Date();
                                    next.setHours(h, m, 0, 0);
                                    field.onChange(next);
                                  }}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          {singleForm.formState.errors.start_time && (
                            <p className="text-sm text-destructive">
                              {
                                singleForm.formState.errors.start_time
                                  .message as string
                              }
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                </FieldGroup>

                <FieldGroup>
                  <Controller
                    name="end_time"
                    control={singleForm.control}
                    render={({ field }) => {
                      const dateVal = asDate(field.value);
                      return (
                        <div className="space-y-1">
                          <Label>End</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                                data-empty={!dateVal ? true : undefined}
                              >
                                {dateVal
                                  ? dayjs(dateVal).format('MMM D, YYYY h:mm A')
                                  : 'Select end date & time'}
                                <ChevronDown />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={dateVal ?? undefined}
                                onSelect={(date) => {
                                  if (!date) return;
                                  const prev = asDate(field.value);
                                  if (prev) {
                                    date.setHours(
                                      prev.getHours(),
                                      prev.getMinutes(),
                                      0,
                                      0
                                    );
                                  }
                                  field.onChange(date);
                                }}
                              />
                              <div className="border-t p-3">
                                <input
                                  type="time"
                                  className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                                  value={
                                    dateVal
                                      ? dayjs(dateVal).format('HH:mm')
                                      : ''
                                  }
                                  onChange={(e) => {
                                    const [h, m] = e.target.value
                                      .split(':')
                                      .map(Number);
                                    const next = dateVal
                                      ? new Date(dateVal)
                                      : new Date();
                                    next.setHours(h, m, 0, 0);
                                    field.onChange(next);
                                  }}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          {singleForm.formState.errors.end_time && (
                            <p className="text-sm text-destructive">
                              {
                                singleForm.formState.errors.end_time
                                  .message as string
                              }
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                </FieldGroup>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="recurring">
            <form
              id="recurring-form"
              onSubmit={recurringForm.handleSubmit(handleRecurringSubmit)}
            >
              <div className="gap-4 flex flex-col">
                {/* Channel */}
                <Controller
                  name="channel_id"
                  control={recurringForm.control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Label>Channel</Label>
                      <SearchableInput
                        {...field}
                        label="Channel"
                        placeholder={channelLabel || 'Select channel'}
                        allowMultiple={false}
                        autoFocus={false}
                        options={channelOptions}
                        onSelect={(value) => {
                          setChannelLabel(value.label);
                          recurringForm.setValue('channel_id', value.value, {
                            shouldValidate: true,
                          });
                        }}
                      />
                      {recurringForm.formState.errors.channel_id && (
                        <p className="text-sm text-destructive">
                          {
                            recurringForm.formState.errors.channel_id
                              .message as string
                          }
                        </p>
                      )}
                    </div>
                  )}
                />

                {/* Rule name */}
                <Controller
                  name="rule_name"
                  control={recurringForm.control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Label>Rule name</Label>
                      <input
                        {...field}
                        type="text"
                        placeholder="Morning News, Football Sundays, …"
                        className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                      />
                    </div>
                  )}
                />

                {/* Days of week */}
                <Controller
                  name="days_of_week"
                  control={recurringForm.control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Label>Days</Label>
                      <div className="flex flex-wrap gap-1 justify-between">
                        {DAY_OPTIONS.map((day) => {
                          const active = field.value.includes(day.value);
                          return (
                            <Button
                              key={day.value}
                              type="button"
                              variant={active ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                const next = active
                                  ? field.value.filter((d) => d !== day.value)
                                  : [...field.value, day.value];
                                field.onChange(next);
                              }}
                            >
                              {day.label}
                            </Button>
                          );
                        })}
                      </div>
                      {recurringForm.formState.errors.days_of_week && (
                        <p className="text-sm text-destructive">
                          {
                            recurringForm.formState.errors.days_of_week
                              .message as string
                          }
                        </p>
                      )}
                    </div>
                  )}
                />

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <Controller
                    name="start_date"
                    control={recurringForm.control}
                    render={({ field }) => {
                      const dateVal = field.value
                        ? dayjs(field.value, 'YYYY-MM-DD').toDate()
                        : undefined;
                      return (
                        <div className="space-y-1">
                          <Label>Start date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                                data-empty={!field.value ? true : undefined}
                              >
                                {field.value
                                  ? dayjs(field.value, 'YYYY-MM-DD').format(
                                      'MMM D, YYYY'
                                    )
                                  : 'Pick date'}
                                <ChevronDown />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={dateVal}
                                onSelect={(date) => {
                                  if (!date) return;
                                  field.onChange(
                                    dayjs(date).format('YYYY-MM-DD')
                                  );
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          {recurringForm.formState.errors.start_date && (
                            <p className="text-sm text-destructive">
                              {
                                recurringForm.formState.errors.start_date
                                  .message as string
                              }
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />

                  <Controller
                    name="end_date"
                    control={recurringForm.control}
                    render={({ field }) => {
                      const startDateStr = recurringForm.watch('start_date');
                      const minDate = startDateStr
                        ? dayjs(startDateStr, 'YYYY-MM-DD').toDate()
                        : undefined;
                      const dateVal = field.value
                        ? dayjs(field.value, 'YYYY-MM-DD').toDate()
                        : undefined;
                      return (
                        <div className="space-y-1">
                          <Label>End date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                                data-empty={!field.value ? true : undefined}
                              >
                                {field.value
                                  ? dayjs(field.value, 'YYYY-MM-DD').format(
                                      'MMM D, YYYY'
                                    )
                                  : 'Pick date'}
                                <ChevronDown />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={dateVal}
                                disabled={
                                  minDate ? { before: minDate } : undefined
                                }
                                onSelect={(date) => {
                                  if (!date) return;
                                  field.onChange(
                                    dayjs(date).format('YYYY-MM-DD')
                                  );
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          {recurringForm.formState.errors.end_date && (
                            <p className="text-sm text-destructive">
                              {
                                recurringForm.formState.errors.end_date
                                  .message as string
                              }
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                </div>

                {/* Time range */}
                <div className="grid grid-cols-2 gap-3">
                  <Controller
                    name="start_time"
                    control={recurringForm.control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Start time</Label>
                        <input
                          type="time"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                        />
                        {recurringForm.formState.errors.start_time && (
                          <p className="text-sm text-destructive">
                            {
                              recurringForm.formState.errors.start_time
                                .message as string
                            }
                          </p>
                        )}
                      </div>
                    )}
                  />

                  <Controller
                    name="end_time"
                    control={recurringForm.control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>End time</Label>
                        <input
                          type="time"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                        />
                        {recurringForm.formState.errors.end_time && (
                          <p className="text-sm text-destructive">
                            {
                              recurringForm.formState.errors.end_time
                                .message as string
                            }
                          </p>
                        )}
                      </div>
                    )}
                  />
                </div>
              </div>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={activeTab === 'single' ? 'single-form' : 'recurring-form'}
            disabled={submitting}
          >
            {submitting
              ? 'Saving…'
              : activeTab === 'single'
                ? recording
                  ? 'Update Recording'
                  : 'Schedule Recording'
                : 'Save Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelRecordingForm;
