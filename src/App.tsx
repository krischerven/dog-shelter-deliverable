import { useState, useEffect, useRef } from 'react';
import { popup, error, coldFetch, objectToQueryParams } from './Util.tsx';
import './App.css';

const HTTPS_BASE_URL: string = 'https://frontend-take-home-service.fetch.com';

// Special endpoints
const ENDPOINT_LOGIN: string = '/auth/login';
const ENDPOINT_LOGOUT: string = '/auth/logout';

// Do we want to send real HTTP requests or simulated requests?
const DRY_RUN: boolean = false;

// Enables debugging conveniences like pre-filled login
const DEBUG_MODE: boolean = false;

function getValue(element_name: string) {
  return (document.getElementById(element_name) as HTMLInputElement).value;
}

function fetch1(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const params = init ? JSON.stringify(init) : '';
  if (DRY_RUN) {
    console.log(`Running dry fetch on input ${input} (params=${params})`);
    return coldFetch(input, init);
  } else {
    console.log(`Running real fetch on input ${input} (params=${params})`);
    return fetch(input, init);
  }
}

function postRequestHelper(
  endpoint: string,
  body?: object,
  dataHandler?: (data: any) => void,
) {
  fetch1(`${HTTPS_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
    credentials: 'include',
  })
    .then((response) => {
      if (!response.ok) {
        if (endpoint === ENDPOINT_LOGIN) {
          const isValidEmail = (email: string): boolean => {
            const regexpr = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return regexpr.test(email);
          };
          if (isValidEmail(getValue("email"))) {
            error("Invalid name.");
          } else {
            error("Invalid email address.");
          }
        } else if (response.status === 401) {
          error("Your session has expired. Please login again to continue.");
        }
        throw new Error(`HTTP POST error! Status: ${response.status}, Error: ${response}`);
      }
      if (endpoint === ENDPOINT_LOGIN || endpoint === ENDPOINT_LOGOUT) {
        return response;
      } else {
        return response.json();
      }
    })
    .then((data) => {
      if (dataHandler) {
        dataHandler(data);
      }
    })
    .catch((error) => {
      console.error(`HTTP POST error: ${error}`);
    });
}

function getRequestHelper(
  endpoint: string,
  params?: object,
  dataHandler?: (data: any) => void,
  extra_params?: string,
) {
  const params_string = params ? `/?${objectToQueryParams(params)}${extra_params || ""}` : '';

  fetch1(`${HTTPS_BASE_URL}${endpoint}${params_string}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) {
          error("Your session has expired. Please login again to continue.");
        }
        throw new Error(`HTTP GET error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data: any) => {
      if (dataHandler) {
        dataHandler(data);
      }
    })
    .catch((error) => {
      console.error(error);
    });
}

interface Dog {
  age: number;
  breed: string;
  id: string;
  img: string;
  name: string;
  zip_code: string;
}

function App() {

  // constants
  const ANY_BREED = 'Any';

  // state
  const [loggedIn, setLoggedIn] = useState(false);
  const [ranSearch, setRanSearch] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const logoutRequested = useRef(false);
  const [dogBreeds, setDogBreeds] = useState<string[]>([]);
  const [selectedBreeds, setSelectedBreeds] = useState<string[]>([]);
  const [selectedZipCodes, setSelectedZipCodes] = useState<string[]>([]);
  const [dogList, setDogList] = useState<Dog[]>([]);
  const [favoriteDogIDs, setFavoriteDogIDs] = useState<string[]>([]);
  const [dogMatch, setDogMatch] = useState<Dog | null>(null);
  const [idToDog, _] = useState<Map<string, Dog>>(new Map<string, Dog>());

  function populateDogBreeds() {
    getRequestHelper('/dogs/breeds', undefined, (data: string[]) => {
      setDogBreeds([ANY_BREED].concat(data));
    });
  }

  function searchDogs(breeds?: string[], zipCodes?: string[]) {

    breeds = breeds || selectedBreeds
    zipCodes = zipCodes || selectedZipCodes

    const params: Record<string, any> = {};
    const setParam = (setting: string, value: any) => {
      if (value) {
        params[setting] = value;
      }
    };

    setParam('ageMin', getValue('min-age'));
    setParam('ageMax', getValue('max-age'));
    setParam('size', getValue('num-results'));
    setParam('from', 0);
    setParam('sort', getValue('sort-by-field'));

    let breedStr = "";
    let zipCodeStr = "";

    if (breeds.length > 0) {
      for (const breed of breeds) {
        breedStr += "&breeds=";
        breedStr += breed;
      }
    }

    if (zipCodes.length > 0) {
      for (const zipCode of zipCodes) {
        zipCodeStr += "&zipCodes=";
        zipCodeStr += zipCode;
      }
    }

    getRequestHelper(
      '/dogs/search',
      params,
      (data: Record<string, string[]>) => {
        postRequestHelper('/dogs/', data.resultIds, (data: Dog[]) => {
          if (data.length === 0) {
            setRanSearch(true);
            setDogList([]);
          } else {
            setDogList(data);
            for (const dog of data) {
              idToDog.set(dog.id, dog);
            }
          }
        });
      },
      zipCodeStr + breedStr,
    );
  }

  function loginRequest() {
    postRequestHelper(
      ENDPOINT_LOGIN,
      {
        name: getValue('name'),
        email: getValue('email'),
      },
      (data) => {
        if (data.status == 200) {
          setLoggedIn(true);
          populateDogBreeds();
        }
      },
    );
  }

  function findDogMatch() {
    if (favoriteDogIDs.length === 0) {
      error("You haven't favorited any dogs yet! Click the star next to at least one dog to see your match.");
      return;
    }
    postRequestHelper('/dogs/match', favoriteDogIDs, (data) => {
      setDogMatch(idToDog.get(data.match)!)
    })
  }

  function loginPage() {

    useEffect(() => {

      if (DEBUG_MODE) {
        const timeoutId = setTimeout(() => {
          (document.getElementById('name') as HTMLInputElement).value = 'me';
          (document.getElementById('email') as HTMLInputElement).value = 'placeholder@gmail.com';
        }, 100);

        // Cleanup function to clear timeout on unmount
        return () => clearTimeout(timeoutId);
      }

    });

    return (
      <>
        <h1>Your local dog shelter</h1>
        <br />
        <div className="grid">
          <label htmlFor="name">Name</label>
          <input type="input" id="name" />
          <label htmlFor="email">Email</label>
          <input type="input" id="email" />
        </div>
        <br />
        <button onClick={loginRequest}>LOGIN</button>
      </>
    );
  }

  function searchPage() {
    useEffect(() => { }, []);

    const dogBreedChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {

      const dogBreed = e.target.value;
      let newBreeds: string[] = [];

      if (selectedBreeds.includes(dogBreed)) {
        return;
      }

      if (dogBreed === ANY_BREED) {
        newBreeds = [];
      } else {
        newBreeds = selectedBreeds.concat(dogBreed);
      }

      setSelectedBreeds(newBreeds);
      searchDogs(newBreeds);

    }

    const removeDogBreed = (breed: string) => {
      const newBreeds = selectedBreeds.filter((breed1: string) => breed1 !== breed);
      setSelectedBreeds(newBreeds);
      searchDogs(newBreeds);
    }

    const addZipCode = () => {

      const zipCode = (document.getElementById("zip-code") as HTMLInputElement).value
      let newZipCodes: string[] = [];

      if (selectedZipCodes.includes(zipCode)) {
        newZipCodes = selectedZipCodes;
      } else {
        newZipCodes = selectedZipCodes.concat(zipCode);
      }

      setSelectedZipCodes(newZipCodes);
      searchDogs(undefined, newZipCodes);

    }

    const removeZipCode = (zipCode: string) => {
      const newZipCodes = selectedZipCodes.filter((zipCode1: string) => zipCode1 !== zipCode);
      setSelectedZipCodes(newZipCodes);
      searchDogs(undefined, newZipCodes);
    }

    const favoriteDog = (dogName: string, dogID: string) => {
      popup(`Favorited <strong>${dogName}</strong>`);
      setFavoriteDogIDs(favoriteDogIDs.concat(dogID));
    }

    const paginatedDogList = (dogList: Dog[]) => {

      const PAGE_SIZE = 9;
      const totalPages = Math.ceil(dogList.length / PAGE_SIZE);
      const paginatedDogs = dogList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

      return (
        <div className="search-view">
          {dogList.length === 0 && ranSearch && (
            <p key="no-search-results">
              <strong>No results found</strong>. Have you tried using a broader set of search parameters?
            </p>
          )}
          {paginatedDogs.map((dog) => (
            <div className="search-grid" key={dog.id}>
              <label htmlFor={dog.id}>
                {dog.name}, a {dog.age} year-old <strong>{dog.breed}</strong><br />
                (ZIP Code {dog.zip_code})
              </label>
              <br />
              <img src={dog.img} alt={dog.name} />
              <img
                className="fav-img"
                src="./favorite.webp"
                alt="Favorite"
                onClick={() => favoriteDog(dog.name, dog.id)}
              />
            </div>
          ))}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                Previous
              </button>
              {[...Array(totalPages)].map((_, index) => (
                <button
                  key={index + 1}
                  className={currentPage === index + 1 ? "active" : ""}
                  onClick={() => setCurrentPage(index + 1)}
                >
                  {index + 1}
                </button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <>
        <h1>Your local dog shelter</h1>
        <div className="grid">

          <label htmlFor="breeds">Add breed</label>
          <select name="breeds" id="breeds" onChange={dogBreedChanged}>
            {dogBreeds.map((breed) => (
              <option key={breed} value={breed}>
                {breed}
              </option>
            ))}
          </select>

          <label htmlFor="zip-code">ZIP Code</label>
          <div style={{ display: "flex" }}>
            <input
              type="number"
              name="zip-code"
              id="zip-code"
              min="00501"
              max="99950"
              defaultValue="00501"
            />
            <button
              name="add-zip-code"
              id="add-zip-code-button"
              onClick={addZipCode}>
              Add
            </button>
          </div>

          <label htmlFor="min-age">Minimum age</label>
          <input
            type="number"
            id="min-age"
            min="0"
            max="19"
            defaultValue="0"
            onChange={() => searchDogs()}
          />

          <label htmlFor="max-age">Maximum age</label>
          <input
            type="number"
            id="max-age"
            min="0"
            max="20"
            defaultValue="20"
            onChange={() => searchDogs()}
          />

          <label htmlFor="# of results"># of results</label>
          <input
            type="number"
            id="num-results"
            min="1"
            max="100"
            defaultValue="25"
            onChange={() => searchDogs()}
          />

          <label htmlFor="sort-by-field">Sort by</label>
          <select name="sort-by-field" id="sort-by-field" onChange={() => searchDogs()}>
            <option value="breed:asc">Breed (A-Z)</option>
            <option value="breed:desc">Breed (Z-A)</option>
            <option value="name:asc">Name (A-Z)</option>
            <option value="name:desc">Name (Z-A)</option>
            <option value="age:asc">Age (asc)</option>
            <option value="age:desc">Age (desc)</option>
          </select>

          <br />
          <br />
        </div>

        {selectedBreeds.length > 0 && (
          <div>
            <br />
            <ul id="taglist">
              <strong>Selected breeds</strong>:&nbsp;
              {selectedBreeds.map((breed) => (
                <>
                  <li key={breed + '-selected'}>{breed}
                    <button key={breed + "-rm"} value={breed} onClick={() => removeDogBreed(breed)}>
                      (X)
                    </button>
                  </li>
                </>
              ))}
            </ul>
            <br />
          </div>
        )}

        {selectedZipCodes.length > 0 && (
          <div>
            {selectedBreeds.length == 0 && <br />}
            <ul id="taglist">
              <strong>Selected zipcodes</strong>:&nbsp;
              {selectedZipCodes.map((zipCode) => (
                <>
                  <li key={"zipCode-" + zipCode + '-selected'}>{zipCode}
                    <button key={"zipCode-" + zipCode + "-rm"} value={zipCode}
                      onClick={() => removeZipCode(zipCode)}>
                      (X)
                    </button>
                  </li>
                </>
              ))}
            </ul>
            <br />
          </div>
        )}

        <button id="search-button" onClick={() => searchDogs()}>
          SEARCH
        </button>

        <button id="match-button" onClick={() => findDogMatch()}>
          MATCH
        </button>

        <div className="search-view">
          {paginatedDogList(dogList)}
        </div>
      </>
    );
  }

  function dogMatchPage() {
    useEffect(() => { }, []);

    if (loggedIn) {
      setLoggedIn(false);
    }

    if (!loggedIn && !logoutRequested.current) {
      logoutRequested.current = true;
      postRequestHelper(ENDPOINT_LOGOUT, undefined, ((data) => {
        if (data.status === 200) {
          console.log("Successfully logged out the user.")
        } else {
          console.log(`Unexpected status: ${data.status}`)
        }
      }))
    }

    // Already checked if the if-else below
    const dog = dogMatch!!;
    return (
      <>
        <button onClick={() => setDogMatch(null)}>Return to login</button>
        <h1>Congratulations on your new pet dog, <strong>{dog.name}</strong>!</h1>
        <img key={dog.id} src={dog.img}></img>
      </>
    )
  }

  if (dogMatch != null) {
    return dogMatchPage();
  } else if (loggedIn) {
    return searchPage();
  } else {
    return loginPage();
  }
}

export default App;
