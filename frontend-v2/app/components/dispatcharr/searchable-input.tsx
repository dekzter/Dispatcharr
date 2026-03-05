import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Popover,
  PopoverAnchor,
  PopoverContent
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Square, SquareCheck, X } from 'lucide-react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { List } from 'react-window';

export const SearchableInput = forwardRef(
  (
    {
      placeholder,
      options,
      onSelect,
      onBlur,
      className,
      allowMultiple = false,
      virtualList = false,
      rowRenderer,
      autoFocus = false,
      clearable = false,
    },
    ref
  ) => {
    const [value, setValue] = useState<string[]>([]);
    const [searchValue, setSearchValue] = useState('');
    const [popoverOpen, setPopoverOpen] = useState(false);

    const optionsSorted = allowMultiple
      ? options.sort(
          (a, b) =>
            value.filter((v) => v.value === b.value).length -
            value.filter((v) => v.value === a.value).length
        )
      : options;

    const handleChange = (option, isActive) => {
      let newValue: string[] = [];
      if (isActive) {
        newValue = allowMultiple
          ? value.filter((v) => v.value !== option.value)
          : [option];
      } else {
        if (allowMultiple) {
          newValue = [...value, option];
        } else {
          newValue = [option];
        }
      }

      setValue(newValue);

      if (!allowMultiple) {
        handlePopoverClose(newValue[0]);
      }
    };

    const handlePopoverClose = (newValue = null) => {
      if (newValue && onSelect) {
        onSelect(newValue)
      }

      if (allowMultiple && onSelect) {
        onSelect(value);
      }

      if (allowMultiple) {
        if (value.length > 0) {
          setSearchValue(`${value.length} selected`);
        } else {
          setSearchValue('');
        }
      } else {
        if (newValue) {
          setSearchValue(newValue.label);
        } else {
          setSearchValue('');
        }
      }

      setPopoverOpen(false);
      if (onBlur) {
        onBlur();
      }
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        setValue([]);
        setSearchValue('');
        setPopoverOpen(false);
        if (onSelect) {
          onSelect(allowMultiple ? [] : undefined);
        }
      },
    }));

    const OptionRow = ({ index, options }) => {
      const option = options[index];
      const isActive = value.filter((v) => v.value === option.value).length > 0;

      return (
        <div
          onClick={() => {
            handleChange(option, isActive);
          }}
        >
          <div className="cursor-pointer hover:bg-secondary flex items-center justify-start gap-2 py-1">
            {isActive && allowMultiple && (
              <div className="flex items-center">
                {allowMultiple ? <SquareCheck size={16} /> : null}
              </div>
            )}
            {!isActive && allowMultiple && (
              <div className="flex items-center">
                {allowMultiple ? <Square size={16} /> : null}
              </div>
            )}
            <div className="text-xs text-center overflow-hidden overflow-ellipsis whitespace-nowrap">
              {option.label}
            </div>
          </div>
        </div>
      );
    };

    const filtered = optionsSorted.filter((option) =>
      option.label.toLowerCase().includes(searchValue?.toLowerCase())
    );

    return (
      <div className="flex items-center">
        <Popover
          modal={true}
          open={popoverOpen}
          onOpenChange={(open) => {
            if (!open) {
              handlePopoverClose();
            }
          }}
        >
          <PopoverAnchor asChild>
            <InputGroup className={`${className}`}>
              <InputGroupInput
                placeholder={placeholder}
                value={searchValue}
                autoFocus={autoFocus}
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => {
                  setSearchValue('');
                  setPopoverOpen(true);
                }}
                onClick={() => {
                  setSearchValue('');
                  setPopoverOpen(true);
                }}
                onKeyDown={(e) => {
                  // Keep popover open while typing
                  if (e.key === 'Escape') {
                    handlePopoverClose();
                  }
                }}
              />
              {clearable && searchValue && (
                <InputGroupAddon
                  align="inline-end"
                  className="cursor-pointer"
                  onClick={() => {
                    setValue([]);
                    setSearchValue('');
                    setPopoverOpen(false);
                    if (onSelect) {
                      onSelect(allowMultiple ? [] : undefined);
                    }
                  }}
                >
                  <X size={16} />
                </InputGroupAddon>
              )}
            </InputGroup>
          </PopoverAnchor>
          <PopoverContent
            className={`max-w-[250px] p-2`}
            onOpenAutoFocus={(e) => {
              // Prevent focus from moving to PopoverContent
              e.preventDefault();
            }}
          >
            {virtualList ? (
              <div className="h-[200px]">
                {filtered.length == 0 ? (
                  <div className="text-xs">No results</div>
                ) : (
                  <List
                    height={200}
                    width="100%"
                    rowCount={filtered.length}
                    rowHeight={25}
                    rowComponent={RowRenderer || OptionRow}
                    rowProps={{ options: filtered }}
                  />
                )}
              </div>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="max-h-[200px]">
                  {filtered.length == 0 ? (
                    <div className="text-xs">No results</div>
                  ) : (
                    filtered.map((option, index) =>
                      rowRenderer ? (
                        rowRenderer({
                          options: filtered,
                          index,
                          handleChange,
                          value,
                        })
                      ) : (
                        <OptionRow
                          key={option.value}
                          index={index}
                          options={filtered}
                        />
                      )
                    )
                  )}
                </div>
              </ScrollArea>
            )}
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

SearchableInput.displayName = 'SearchableInput';
