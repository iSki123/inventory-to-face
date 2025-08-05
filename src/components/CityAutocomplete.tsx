import React, { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Major US cities data
const majorCities: City[] = [
  { name: "New York", state: "New York" },
  { name: "Los Angeles", state: "California" },
  { name: "Chicago", state: "Illinois" },
  { name: "Houston", state: "Texas" },
  { name: "Phoenix", state: "Arizona" },
  { name: "Philadelphia", state: "Pennsylvania" },
  { name: "San Antonio", state: "Texas" },
  { name: "San Diego", state: "California" },
  { name: "Dallas", state: "Texas" },
  { name: "San Jose", state: "California" },
  { name: "Austin", state: "Texas" },
  { name: "Jacksonville", state: "Florida" },
  { name: "Fort Worth", state: "Texas" },
  { name: "Columbus", state: "Ohio" },
  { name: "Charlotte", state: "North Carolina" },
  { name: "San Francisco", state: "California" },
  { name: "Indianapolis", state: "Indiana" },
  { name: "Seattle", state: "Washington" },
  { name: "Denver", state: "Colorado" },
  { name: "Washington", state: "District of Columbia" },
  { name: "Boston", state: "Massachusetts" },
  { name: "El Paso", state: "Texas" },
  { name: "Nashville", state: "Tennessee" },
  { name: "Detroit", state: "Michigan" },
  { name: "Oklahoma City", state: "Oklahoma" },
  { name: "Portland", state: "Oregon" },
  { name: "Las Vegas", state: "Nevada" },
  { name: "Memphis", state: "Tennessee" },
  { name: "Louisville", state: "Kentucky" },
  { name: "Baltimore", state: "Maryland" },
  { name: "Milwaukee", state: "Wisconsin" },
  { name: "Albuquerque", state: "New Mexico" },
  { name: "Tucson", state: "Arizona" },
  { name: "Fresno", state: "California" },
  { name: "Mesa", state: "Arizona" },
  { name: "Sacramento", state: "California" },
  { name: "Atlanta", state: "Georgia" },
  { name: "Kansas City", state: "Missouri" },
  { name: "Colorado Springs", state: "Colorado" },
  { name: "Miami", state: "Florida" },
  { name: "Raleigh", state: "North Carolina" },
  { name: "Omaha", state: "Nebraska" },
  { name: "Long Beach", state: "California" },
  { name: "Virginia Beach", state: "Virginia" },
  { name: "Oakland", state: "California" },
  { name: "Minneapolis", state: "Minnesota" },
  { name: "Tulsa", state: "Oklahoma" },
  { name: "Arlington", state: "Texas" },
  { name: "Tampa", state: "Florida" },
  { name: "New Orleans", state: "Louisiana" },
  { name: "Wichita", state: "Kansas" },
  { name: "Cleveland", state: "Ohio" },
  { name: "Bakersfield", state: "California" },
  { name: "Aurora", state: "Colorado" },
  { name: "Anaheim", state: "California" },
  { name: "Honolulu", state: "Hawaii" },
  { name: "Santa Ana", state: "California" },
  { name: "Riverside", state: "California" },
  { name: "Corpus Christi", state: "Texas" },
  { name: "Lexington", state: "Kentucky" },
  { name: "Stockton", state: "California" },
  { name: "Henderson", state: "Nevada" },
  { name: "Saint Paul", state: "Minnesota" },
  { name: "St. Louis", state: "Missouri" },
  { name: "Cincinnati", state: "Ohio" },
  { name: "Pittsburgh", state: "Pennsylvania" },
  { name: "Greensboro", state: "North Carolina" },
  { name: "Anchorage", state: "Alaska" },
  { name: "Plano", state: "Texas" },
  { name: "Lincoln", state: "Nebraska" },
  { name: "Orlando", state: "Florida" },
  { name: "Irvine", state: "California" },
  { name: "Newark", state: "New Jersey" },
  { name: "Durham", state: "North Carolina" },
  { name: "Chula Vista", state: "California" },
  { name: "Toledo", state: "Ohio" },
  { name: "Fort Wayne", state: "Indiana" },
  { name: "St. Petersburg", state: "Florida" },
  { name: "Laredo", state: "Texas" },
  { name: "Jersey City", state: "New Jersey" },
  { name: "Chandler", state: "Arizona" },
  { name: "Madison", state: "Wisconsin" },
  { name: "Lubbock", state: "Texas" },
  { name: "Scottsdale", state: "Arizona" },
  { name: "Reno", state: "Nevada" },
  { name: "Buffalo", state: "New York" },
  { name: "Gilbert", state: "Arizona" },
  { name: "Glendale", state: "Arizona" },
  { name: "North Las Vegas", state: "Nevada" },
  { name: "Winston-Salem", state: "North Carolina" },
  { name: "Chesapeake", state: "Virginia" },
  { name: "Norfolk", state: "Virginia" },
  { name: "Fremont", state: "California" },
  { name: "Garland", state: "Texas" },
  { name: "Irving", state: "Texas" },
  { name: "Hialeah", state: "Florida" },
  { name: "Richmond", state: "Virginia" },
  { name: "Boise", state: "Idaho" },
  { name: "Spokane", state: "Washington" },
  { name: "Baton Rouge", state: "Louisiana" },
  { name: "Tacoma", state: "Washington" },
  { name: "San Bernardino", state: "California" },
  { name: "Modesto", state: "California" },
  { name: "Fontana", state: "California" },
  { name: "Des Moines", state: "Iowa" },
  { name: "Moreno Valley", state: "California" },
  { name: "Santa Clarita", state: "California" },
  { name: "Fayetteville", state: "North Carolina" },
  { name: "Birmingham", state: "Alabama" },
  { name: "Oxnard", state: "California" },
  { name: "Rochester", state: "New York" },
  { name: "Port St. Lucie", state: "Florida" },
  { name: "Grand Rapids", state: "Michigan" },
  { name: "Huntsville", state: "Alabama" },
  { name: "Salt Lake City", state: "Utah" },
  { name: "Frisco", state: "Texas" },
  { name: "Yonkers", state: "New York" },
  { name: "Amarillo", state: "Texas" },
  { name: "Glendale", state: "California" },
  { name: "Huntington Beach", state: "California" },
  { name: "McKinney", state: "Texas" },
  { name: "Montgomery", state: "Alabama" },
  { name: "Augusta", state: "Georgia" },
  { name: "Aurora", state: "Illinois" },
  { name: "Akron", state: "Ohio" },
  { name: "Little Rock", state: "Arkansas" },
  { name: "Tempe", state: "Arizona" },
  { name: "Columbus", state: "Georgia" },
  { name: "Overland Park", state: "Kansas" },
  { name: "Grand Prairie", state: "Texas" },
  { name: "Tallahassee", state: "Florida" },
  { name: "Cape Coral", state: "Florida" },
  { name: "Mobile", state: "Alabama" },
  { name: "Knoxville", state: "Tennessee" },
  { name: "Shreveport", state: "Louisiana" },
  { name: "Worcester", state: "Massachusetts" },
  { name: "Ontario", state: "California" },
  { name: "Vancouver", state: "Washington" },
  { name: "Sioux Falls", state: "South Dakota" },
  { name: "Chattanooga", state: "Tennessee" },
  { name: "Brownsville", state: "Texas" },
  { name: "Fort Lauderdale", state: "Florida" },
  { name: "Providence", state: "Rhode Island" },
  { name: "Newport News", state: "Virginia" },
  { name: "Rancho Cucamonga", state: "California" },
  { name: "Santa Rosa", state: "California" },
  { name: "Peoria", state: "Arizona" },
  { name: "Oceanside", state: "California" },
  { name: "Elk Grove", state: "California" },
  { name: "Salem", state: "Oregon" },
  { name: "Pembroke Pines", state: "Florida" },
  { name: "Eugene", state: "Oregon" },
  { name: "Garden Grove", state: "California" },
  { name: "Cary", state: "North Carolina" },
  { name: "Fort Collins", state: "Colorado" },
  { name: "Corona", state: "California" },
  { name: "Springfield", state: "Missouri" },
  { name: "Jackson", state: "Mississippi" },
  { name: "Alexandria", state: "Virginia" },
  { name: "Hayward", state: "California" },
  { name: "Clarksville", state: "Tennessee" },
  { name: "Lakewood", state: "Colorado" },
  { name: "Lancaster", state: "California" },
  { name: "Salinas", state: "California" },
  { name: "Palmdale", state: "California" },
  { name: "Hollywood", state: "Florida" },
  { name: "Springfield", state: "Massachusetts" },
  { name: "Macon", state: "Georgia" },
  { name: "Kansas City", state: "Kansas" },
  { name: "Sunnyvale", state: "California" },
  { name: "Pomona", state: "California" },
  { name: "Killeen", state: "Texas" },
  { name: "Escondido", state: "California" },
  { name: "Pasadena", state: "Texas" },
  { name: "Naperville", state: "Illinois" },
  { name: "Bellevue", state: "Washington" },
  { name: "Joliet", state: "Illinois" },
  { name: "Murfreesboro", state: "Tennessee" },
  { name: "Rockford", state: "Illinois" },
  { name: "Savannah", state: "Georgia" },
  { name: "Paterson", state: "New Jersey" },
  { name: "Torrance", state: "California" },
  { name: "Bridgeport", state: "Connecticut" },
  { name: "Mesquite", state: "Texas" },
  { name: "Sterling Heights", state: "Michigan" },
  { name: "Syracuse", state: "New York" },
  { name: "McAllen", state: "Texas" },
  { name: "Pasadena", state: "California" },
  { name: "El Monte", state: "California" },
  { name: "Thousand Oaks", state: "California" },
  { name: "Cedar Rapids", state: "Iowa" },
  { name: "Miami Gardens", state: "Florida" },
  { name: "Waco", state: "Texas" },
  { name: "Coral Springs", state: "Florida" },
  { name: "Elizabeth", state: "New Jersey" },
  { name: "Carrollton", state: "Texas" },
  { name: "Topeka", state: "Kansas" },
  { name: "Simi Valley", state: "California" },
  { name: "Stamford", state: "Connecticut" },
  { name: "Concord", state: "California" },
  { name: "Hartford", state: "Connecticut" },
  { name: "Kent", state: "Washington" },
  { name: "Lafayette", state: "Louisiana" },
  { name: "Midland", state: "Texas" },
  { name: "Surprise", state: "Arizona" },
  { name: "Denton", state: "Texas" },
  { name: "Victorville", state: "California" },
  { name: "Evansville", state: "Indiana" },
  { name: "Santa Clara", state: "California" },
  { name: "Abilene", state: "Texas" },
  { name: "Athens", state: "Georgia" },
  { name: "Vallejo", state: "California" },
  { name: "Allentown", state: "Pennsylvania" },
  { name: "Norman", state: "Oklahoma" },
  { name: "Beaumont", state: "Texas" },
  { name: "Independence", state: "Missouri" },
  { name: "Murrieta", state: "California" },
  { name: "Ann Arbor", state: "Michigan" },
  { name: "Springfield", state: "Illinois" },
  { name: "Berkeley", state: "California" },
  { name: "Peoria", state: "Illinois" },
  { name: "Provo", state: "Utah" },
  { name: "El Cajon", state: "California" },
  { name: "Lansing", state: "Michigan" },
  { name: "Fargo", state: "North Dakota" },
  { name: "Columbia", state: "Missouri" },
  { name: "Inglewood", state: "California" },
  { name: "Richardson", state: "Texas" },
  { name: "Arvada", state: "Colorado" },
  { name: "Cambridge", state: "Massachusetts" },
  { name: "Sugar Land", state: "Texas" },
  { name: "Lansing", state: "Michigan" },
  { name: "Evanston", state: "Illinois" },
  { name: "College Station", state: "Texas" },
  { name: "Fairfield", state: "California" },
  { name: "Clearwater", state: "Florida" },
  { name: "West Valley City", state: "Utah" },
  { name: "North Aurora", state: "Illinois" }
];

export function CityAutocomplete({ value, onChange, placeholder = "Select city...", className }: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filteredCities, setFilteredCities] = useState<City[]>([]);

  useEffect(() => {
    if (searchValue.length < 2) {
      setFilteredCities([]);
      return;
    }

    const filtered = majorCities
      .filter(city => 
        city.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        city.state.toLowerCase().includes(searchValue.toLowerCase())
      )
      .slice(0, 50); // Limit to 50 results for performance
    
    setFilteredCities(filtered);
  }, [searchValue]);

  const formatCityState = (city: City) => `${city.name}, ${city.state}`;

  const selectedCity = majorCities.find(city => formatCityState(city) === value);

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
              {filteredCities.map((city) => {
                const cityState = formatCityState(city);
                return (
                  <CommandItem
                    key={cityState}
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