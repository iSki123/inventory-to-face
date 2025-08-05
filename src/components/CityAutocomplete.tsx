import React, { useState, useEffect, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import cities from 'all-the-cities';

interface City {
  name: string;
  state: string;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CityAutocomplete({ value, onChange, placeholder = "Select city...", className }: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filteredCities, setFilteredCities] = useState<City[]>([]);

  // Process and filter US cities from all-the-cities data
  const usCities = useMemo(() => {
    return cities
      .filter((city: any) => city.country === 'US' && city.name && city.adminCode)
      .map((city: any) => ({
        name: city.name,
        state: city.adminCode
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  useEffect(() => {
    if (searchValue.length < 2) {
      setFilteredCities([]);
      return;
    }

    const filtered = usCities
      .filter(city => 
        city.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        city.state.toLowerCase().includes(searchValue.toLowerCase())
      )
      .slice(0, 100); // Limit to 100 results for performance
    
    setFilteredCities(filtered);
  }, [searchValue, usCities]);

  const formatCityState = (city: City) => `${city.name}, ${city.state}`;

  const selectedCity = usCities.find(city => formatCityState(city) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedCity ? formatCityState(selectedCity) : value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search cities..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {searchValue.length < 2 
                ? "Type at least 2 characters to search..." 
                : "No cities found."
              }
            </CommandEmpty>
            <CommandGroup>
              {filteredCities.map((city, index) => {
                const cityState = formatCityState(city);
                return (
                  <CommandItem
                    key={`${cityState}-${index}`}
                    value={cityState}
                    onSelect={() => {
                      onChange(cityState);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === cityState ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {cityState}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}