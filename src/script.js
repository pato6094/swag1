const referralTag = "pato666-21"; // Il tuo tag di affiliazione

// Funzione per estrarre l'ASIN da un link completo
function extractASINFromFullLink(url) {
    const fullLinkPattern = /\/(?:dp|offer-listing)\/([A-Z0-9]{10})(?:\/|\?)/;
    const fullMatch = url.match(fullLinkPattern);

    if (fullMatch && fullMatch[1]) {
        return fullMatch[1]; // Restituisce l'ASIN trovato nel link lungo
    }

    return null; // Se nessun ASIN è trovato
}

// Funzione per estrarre l'ASIN da un link corto (es. amzn.eu)
function extractASIN(link) {
    console.log("Link in ingresso:", link); 

    const shortLinkPattern = /https:\/\/amzn\.eu\/d\/([A-Za-z0-9]+)/;
    const match = link.match(shortLinkPattern);

    if (match && match[1]) {
        const shortCode = match[1];
        console.log("Codice corto trovato:", shortCode);

        const apiUrl = `https://verificaprezzo.eu/shortlink/${shortCode}`;

        return fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.longUrl) {
                    const longUrl = data.longUrl;
                    console.log("Link lungo:", longUrl);
                    return extractASINFromFullLink(longUrl);
                } else {
                    alert("Errore nel recupero del link lungo.");
                    return null;
                }
            })
            .catch(error => {
                console.error("Errore nell'API:", error);
                alert("Errore nell'API. Riprova.");
                return null;
            });
    }

    return new Promise((resolve) => {
        const asin = extractASINFromFullLink(link);
        resolve(asin);
    });
}

// Funzione per gestire la ricerca quando l'utente inserisce un link
function handleSearch() {
    const input = document.getElementById('inputLink').value.trim(); 

    if (input) {
        if (input.startsWith("https://amzn.eu/d/")) {
            const shortCode = input.split('/d/')[1];
            const apiUrl = `https://verificaprezzo.eu/shortlink/${shortCode}`;

            fetch(apiUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.longUrl) {
                        const longUrl = data.longUrl;
                        const asin = extractASINFromFullLink(longUrl);
                        if (asin) {
                            const newLink = `https://www.amazon.it/gp/offer-listing/${asin}/?tag=${referralTag}`;
                            window.location.href = newLink;
                        } else {
                            alert("ASIN non trovato nel link lungo.");
                        }
                    } else {
                        alert("Errore nel recupero del link lungo.");
                    }
                })
                .catch(error => {
                    console.error("Errore nell'API:", error);
                    alert("Errore nell'API. Riprova.");
                });
        } else if (input.startsWith("https://www.amazon.it/") || input.startsWith("https://www.amazon.com/")) {
            const asin = extractASINFromFullLink(input);
            if (asin) {
                const newLink = `https://www.amazon.it/gp/offer-listing/${asin}/?tag=${referralTag}`;
                window.open(newLink, '_blank'); 
            } else {
                alert("ASIN non trovato nel link lungo.");
            }
        } else {
            alert("Per favore, inserisci un link Amazon valido.");
        }
    } else {
        alert("Per favore, inserisci un link Amazon valido.");
    }
}

// Funzione per mostrare il grafico del prodotto su Keepa
function showGraph() {
    const inputLink = document.getElementById('inputLink').value.trim();
    
    if (inputLink.startsWith('https://amzn.eu/d/')) {
        const shortCode = inputLink.split('/d/')[1];
        const apiUrl = `https://verificaprezzo.eu/shortlink/${shortCode}`;
        
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.longUrl) {
                    const longUrl = data.longUrl;
                    const asin = extractASINFromFullLink(longUrl);
                    if (asin) {
                        const graphLink = `https://keepa.com/#!product/8-${asin}`;
                        window.open(graphLink, '_blank');
                    } else {
                        alert("ASIN non trovato nel link lungo.");
                    }
                } else {
                    alert("Errore nel recupero del link lungo.");
                }
            })
            .catch(error => {
                console.error("Errore nell'API:", error);
                alert("Errore nell'API. Riprova.");
            });
    } else {
        extractASIN(inputLink).then(asin => {
            if (asin) {
                const graphLink = `https://keepa.com/#!product/8-${asin}`;
                window.open(graphLink, '_blank');
            } else {
                alert("Per favore, inserisci un link Amazon valido");
            }
        });
    }
}

// Funzione per una nuova ricerca
function newSearch() {
    document.getElementById('inputLink').value = ''; 
    document.getElementById('result').innerText = ''; 
}

// Funzione per eliminare la cache
function deleteCache() {
    fetch('delete_cache.php')
        .then(response => response.text())
        .then(data => {
            console.log('Cache eliminata:', data);
        })
        .catch(error => {
            console.error('Errore durante la cancellazione della cache:', error);
        });
}

// Esegui deleteCache() appena il sito è caricato
window.onload = function() {
    deleteCache();
};
