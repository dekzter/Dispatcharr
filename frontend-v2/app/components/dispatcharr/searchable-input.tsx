import React, { useState } from 'react';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group';
import { Input } from '~/components/ui/input';
import { List } from 'react-window';
import { set } from 'react-hook-form';
import { X } from 'lucide-react';
import { ScrollArea } from '~/components/ui/scroll-area';

export const SearchableInput = ({
  placeholder,
  options,
  onSelect,
  onBlur,
  className,
  allowMultiple = false,
  virtualList = false,
  rowRenderer,
  autoFocus = true,
}) => {
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
    if (onSelect) {
      if (allowMultiple) {
        onSelect(newValue);
      } else {
        onSelect(newValue[0]);
      }
    }

    setPopoverOpen(false);
  };

  const handlePopoverClose = () => {
    setPopoverOpen(false);
  };

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
              {allowMultiple ? <X size={16} /> : null}
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
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="flex items-center">
      <Popover
        modal={true}
        open={popoverOpen}
        onOpenChange={(open) => {
          setPopoverOpen(open);
          if (!open) {
            setSearchValue('');
            if (onBlur) {
              onBlur();
            }
          }
        }}
      >
        <PopoverAnchor asChild>
          <Input
            className={className}
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
};
