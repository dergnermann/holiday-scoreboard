// --- DOM ELEMENTS ---
// Note: We no longer need the STORAGE_KEY constant
const inputScreen = document.getElementById('input-screen');
const scoreboardScreen = document.getElementById('scoreboard-screen');
const scoreInputBody = document.getElementById('score-input-body');
const scoreboardBody = document.getElementById('scoreboard-body');
const scoreInputForm = document.getElementById('score-input-form');
const goToScoreboardBtn = document.getElementById('go-to-scoreboard-btn');
const goToInputBtn = document.getElementById('go-to-input-btn');
const addPlayerBtn = document.getElementById('add-player-btn');
const removePlayerBtn = document.getElementById('remove-player-btn');


// --- 1. SCREEN NAVIGATION LOGIC ---
// Navigation functions must now be asynchronous because they call database functions

async function showScoreboard() {
    inputScreen.style.display = 'none';
    scoreboardScreen.style.display = 'block';
    await renderScoreboard(); // Wait for data to load
}

function showInput() {
    scoreboardScreen.style.display = 'none';
    inputScreen.style.display = 'block';
    generateInputRows();
}

goToScoreboardBtn.addEventListener('click', showScoreboard);
goToInputBtn.addEventListener('click', showInput);


// --- 2. DATABASE READ/WRITE FUNCTIONS (NEW) ---

/**
 * Retrieves stored scores from Firestore.
 * @returns {Array} An array of player score objects (or an empty array).
 */
async function getScoresFromDatabase() {
    try {
        // scoresDocRef is defined in the <script> tag in index.html
        const doc = await scoresDocRef.get();
        if (doc.exists) {
            // Firestore data is read from the 'players' field
            return doc.data().players || [];
        } else {
            // Document doesn't exist yet, return empty list
            console.log("No scoreboard data found in Firestore, starting fresh.");
            return [];
        }
    } catch (error) {
        console.error("Error fetching data from Firestore:", error);
        alert("Error loading scores from server. Check console for details.");
        return [];
    }
}

/**
 * Saves an array of player objects to Firestore.
 * @param {Array} players - The array of player score objects to save.
 */
async function saveScoresToDatabase(players) {
    try {
        // Overwrite the 'players' array in the specific document
        await scoresDocRef.set({ players: players });
        return true;
    } catch (error) {
        console.error("Error saving data to Firestore:", error);
        alert("Error saving scores to server. Check console for details.");
        return false;
    }
}


// --- 3. INPUT GENERATION LOGIC (UPDATED to be async) ---

/**
 * Generates input rows based on saved data, or creates 30 empty rows if no data exists.
 */
async function generateInputRows() {
    // Wait for players array to load from the server
    const savedData = await getScoresFromDatabase(); 
    scoreInputBody.innerHTML = ''; 

    // Determine the number of rows needed (30 is the default minimum)
    const numRows = savedData.length > 0 ? savedData.length : 30;

    for (let i = 0; i < numRows; i++) { 
        const row = document.createElement('tr');
        const player = savedData[i] || { name: `Player ${i + 1}`, toss: '', plinko: '', fluff: '' };
        const playerIndex = i; 

        row.innerHTML = `
            <td><input type="text" name="name-${playerIndex}" value="${player.name}" placeholder="Player ${i + 1}" required></td>
            <td><input type="number" name="toss-${playerIndex}" value="${player.toss}" min="0" data-game="Snowball Toss"></td>
            <td><input type="number" name="plinko-${playerIndex}" value="${player.plinko}" min="0" data-game="North Pole Plinko"></td>
            <td><input type="number" name="fluff-${playerIndex}" value="${player.fluff}" min="0" data-game="Reindeer Fluff Roundup"></td>
        `;
        scoreInputBody.appendChild(row);
    }
}


// --- 4. DATA SAVING HANDLER (UPDATED to be async) ---

/**
 * Handles the form submission to collect and save all scores to Firestore.
 */
async function handleSaveScores(event) {
    event.preventDefault();

    const formData = new FormData(scoreInputForm);
    const players = [];

    // Logic to collect all player data from the dynamically generated inputs
    const formKeys = Array.from(formData.keys());
    const indices = new Set();
    formKeys.forEach(key => {
        const match = key.match(/-\d+$/);
        if (match) {
            indices.add(parseInt(match[0].substring(1)));
        }
    });

    const sortedIndices = Array.from(indices).sort((a, b) => a - b);

    sortedIndices.forEach(i => {
        const name = formData.get(`name-${i}`).trim();
        const toss = parseInt(formData.get(`toss-${i}`)) || 0;
        const plinko = parseInt(formData.get(`plinko-${i}`)) || 0;
        const fluff = parseInt(formData.get(`fluff-${i}`)) || 0;

        // Only save players who have a non-empty name
        if (name) {
             players.push({
                name: name,
                toss: toss,
                plinko: plinko,
                fluff: fluff
            });
        }
    });

    // Save to database and alert user
    const saved = await saveScoresToDatabase(players);
    if (saved) {
        alert('Scores saved successfully to the server!');
        // Re-generate rows to reflect any changes or cleanup of empty rows
        generateInputRows(); 
    }
}

scoreInputForm.addEventListener('submit', handleSaveScores);


// --- 5. PLAYER MANAGEMENT LOGIC (UPDATED to be async) ---

/**
 * Adds a new, empty player slot and saves it to the database.
 */
async function addPlayer() {
    const players = await getScoresFromDatabase(); // Load current state
    const newPlayerName = `Player ${players.length + 1}`; 
    
    players.push({ 
        name: newPlayerName, 
        toss: 0, 
        plinko: 0, 
        fluff: 0 
    });

    const saved = await saveScoresToDatabase(players);
    if (saved) {
        generateInputRows();
        alert(`Added new player: ${newPlayerName}. Please enter scores.`);
    }
}

/**
 * Removes the last player and updates the database.
 */
async function removePlayer() {
    const players = await getScoresFromDatabase(); // Load current state
    
    if (players.length > 0) {
        const removedPlayer = players.pop();
        const saved = await saveScoresToDatabase(players);
        
        if (saved) {
            generateInputRows();
            alert(`Removed player: ${removedPlayer.name}.`);
        }
    } else {
        alert("Cannot remove. The player list is empty.");
    }
}

addPlayerBtn.addEventListener('click', addPlayer);
removePlayerBtn.addEventListener('click', removePlayer);


// --- 6. SCOREBOARD CALCULATION AND RENDERING (UPDATED to be async) ---

async function renderScoreboard() {
    // Wait for the data to load from the database
    const players = await getScoresFromDatabase(); 

    if (players.length === 0) {
        scoreboardBody.innerHTML = '<tr><td colspan="6">No scores saved yet. Please enter scores on the input screen.</td></tr>';
        return;
    }

    // 1. Calculate Total Scores
    const playersWithTotals = players.map(player => ({
        ...player,
        total: player.toss + player.plinko + player.fluff
    }));

    // 2. Sort by Total Score (Descending)
    playersWithTotals.sort((a, b) => b.total - a.total);

    // 3. Render the Table
    scoreboardBody.innerHTML = '';
    
    playersWithTotals.forEach((player, index) => {
        const rank = index + 1;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rank}</td>
            <td>${player.name}</td>
            <td>${player.toss}</td>
            <td>${player.plinko}</td>
            <td>${player.fluff}</td>
            <td><strong>${player.total}</strong></td>
        `;
        scoreboardBody.appendChild(row);
    });
}


// --- INITIALIZATION (UPDATED to be async) ---
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for rows to be generated from the database data before showing the input screen
    await generateInputRows();
    showInput();
});