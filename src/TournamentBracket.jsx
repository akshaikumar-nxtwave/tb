import React, { useState, useMemo } from 'react';
import { ChevronDown, Trophy, Trash2, Zap } from 'lucide-react';

const TournamentBracket = () => {
  const [numTeams, setNumTeams] = useState('8');
  const [started, setStarted] = useState(false);
  const [bracket, setBracket] = useState(null);
  const [matchResults, setMatchResults] = useState({});
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [thirdPlaceWinner, setThirdPlaceWinner] = useState(null);
  const [showThirdPlaceModal, setShowThirdPlaceModal] = useState(false);

  const teams = useMemo(() => {
    const n = Math.max(0, parseInt(numTeams) || 0);
    return Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      logo: String.fromCharCode(65 + (i % 26)),
    }));
  }, [numTeams]);

  const usedTeamsInLevel0 = useMemo(() => {
    const used = new Set();
    if (!bracket) return used;
    
    // Collect all teams from level 0 (left and right sides)
    if (bracket.leftSide?.level0) {
      bracket.leftSide.level0.forEach(match => {
        if (match.team1?.id) used.add(match.team1.id);
        if (match.team2?.id) used.add(match.team2.id);
      });
    }
    
    if (bracket.rightSide?.level0) {
      bracket.rightSide.level0.forEach(match => {
        if (match.team1?.id) used.add(match.team1.id);
        if (match.team2?.id) used.add(match.team2.id);
      });
    }
    
    return used;
  }, [bracket]);

  const availableTeams = teams.filter(t => !usedTeamsInLevel0.has(t.id));

  const initializeBracket = () => {
    const n = parseInt(numTeams);
    if (!Number.isInteger(Math.log2(n)) || n < 2) {
      alert('Please enter a power of 2 (2, 4, 8, 16, 32)');
      return;
    }

    const createRound = (count) => {
      return Array.from({ length: count }, () => ({
        team1: null,
        team2: null,
      }));
    };

    const teamsPerSide = n / 2;
    const numRounds = Math.log2(teamsPerSide);

    // Create left and right sides independently
    let leftSide = {};
    let rightSide = {};

    for (let i = 0; i < numRounds; i++) {
      const matchCount = Math.pow(2, numRounds - i - 1);
      const roundKey = `level${i}`;
      leftSide[roundKey] = createRound(matchCount);
      rightSide[roundKey] = createRound(matchCount);
    }

    // Create finals
    const finalsRound = createRound(1);

    setBracket({
      leftSide,
      rightSide,
      finals: finalsRound,
    });
    setMatchResults({});
    setSelectedMatch(null);
    setThirdPlaceWinner(null);
    setStarted(true);
  };

  const updateTeam = (side, level, matchIdx, position, team) => {
    setBracket(prev => ({
      ...prev,
      [side]: {
        ...prev[side],
        [level]: prev[side][level].map((match, idx) =>
          idx === matchIdx
            ? { ...match, [position]: team }
            : match
        ),
      },
    }));
  };

  const removeTeam = (side, level, matchIdx, position) => {
    updateTeam(side, level, matchIdx, position, null);
  };

  const selectWinner = (side, level, matchIdx, teamId) => {
    const key = `${side}-${level}-${matchIdx}`;
    setMatchResults(prev => ({ ...prev, [key]: teamId }));

    const sideData = bracket[side];
    const match = sideData[level][matchIdx];
    const winner = match.team1.id === teamId ? match.team1 : match.team2;

    // Get next level info
    const levelNum = parseInt(level.replace('level', ''));
    const nextLevelKey = `level${levelNum + 1}`;

    if (sideData[nextLevelKey]) {
      const nextMatchIdx = Math.floor(matchIdx / 2);
      const position = matchIdx % 2 === 0 ? 'team1' : 'team2';

      setTimeout(() => {
        updateTeam(side, nextLevelKey, nextMatchIdx, position, winner);
      }, 300);
    } else {
      // Move to finals
      setTimeout(() => {
        const finalPosition = side === 'leftSide' ? 'team1' : 'team2';
        setBracket(prev => ({
          ...prev,
          finals: [{
            ...prev.finals[0],
            [finalPosition]: winner,
          }],
        }));
      }, 300);
    }

    setSelectedMatch(null);
  };

  const getRankings = () => {
    if (!bracket) {
      return { winner: null, runnerUp: null, thirdPlaceContenders: [] };
    }

    const finalMatch = bracket.finals?.[0];
    const finalKey = `finals-0`;

    let winner = null;
    let runnerUp = null;

    if (finalMatch?.team1 && finalMatch?.team2 && matchResults[finalKey]) {
      const winnerId = matchResults[finalKey];
      winner = finalMatch.team1.id === winnerId ? finalMatch.team1 : finalMatch.team2;
      runnerUp = finalMatch.team1.id === winnerId ? finalMatch.team2 : finalMatch.team1;
    }

    // Get 3rd place contenders (semifinal losers from both sides)
    const thirdPlaceContenders = [];

    // Find last level before finals (semifinals) for both sides
    const getSemifinalistLoser = (side) => {
      const sideData = bracket[side];
      const levels = Object.keys(sideData)
        .filter(k => k.startsWith('level'))
        .sort((a, b) => {
          return parseInt(a.replace('level', '')) - parseInt(b.replace('level', ''));
        });

      const lastLevel = levels[levels.length - 1];
      if (!lastLevel) return null;

      const semifinalMatch = sideData[lastLevel]?.[0];
      const key = `${side}-${lastLevel}-0`;
      const winnerId = matchResults[key];

      if (winnerId && semifinalMatch?.team1?.id && semifinalMatch?.team2?.id) {
        return semifinalMatch.team1.id === winnerId ? semifinalMatch.team2 : semifinalMatch.team1;
      }
      return null;
    };

    const leftLoser = getSemifinalistLoser('leftSide');
    const rightLoser = getSemifinalistLoser('rightSide');

    if (leftLoser) thirdPlaceContenders.push(leftLoser);
    if (rightLoser) thirdPlaceContenders.push(rightLoser);

    return { winner, runnerUp, thirdPlaceContenders };
  };

  const MatchSlot = ({ side, level, matchIdx, position }) => {
    if (!bracket) return null;

    const match = bracket[side][level][matchIdx];
    const team = match?.[position];
    const key = `${side}-${level}-${matchIdx}`;
    const isWinner = matchResults[key] === team?.id;
    const isLevel0 = level === 'level0';

    return (
      <div className="flex-1">
        <div
          className={`
            relative border-2 rounded-lg p-2 transition-all max-w-full
            ${!team ? 'border-slate-300 bg-slate-50 hover:bg-slate-100' : ''}
            ${team && isWinner ? 'border-emerald-500 bg-emerald-50' : ''}
            ${team && matchResults[key] && !isWinner ? 'border-red-500 bg-red-50' : ''}
            ${team && !matchResults[key] ? 'border-blue-400 bg-blue-50' : ''}
            group
            ${isLevel0 ? 'cursor-pointer' : ''}
          `}
        >
          {!team && isLevel0 ? (
            <TeamDropdown
              teams={availableTeams}
              onSelect={(t) => updateTeam(side, level, matchIdx, position, t)}
              placeholder="Select team"
            />
          ) : team ? (
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 flex-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {team.logo}
                </div>
                <span className={`font-semibold text-xs truncate ${isWinner ? 'text-emerald-700' : matchResults[key] ? 'text-red-700' : 'text-slate-700'}`}>
                  {team.name}
                </span>
              </div>
              {isLevel0 && (
                <button
                  onClick={() => removeTeam(side, level, matchIdx, position)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-200 rounded flex-shrink-0"
                >
                  <Trash2 size={12} className="text-red-600" />
                </button>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-xs">—</div>
          )}
        </div>
      </div>
    );
  };

  const TeamDropdown = ({ teams, onSelect, placeholder }) => {
    const [open, setOpen] = useState(false);

    return (
      <div className="relative z-30">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between text-left text-slate-500 hover:text-slate-700 text-xs gap-1"
        >
          <span className="truncate">{placeholder}</span>
          <ChevronDown size={14} className="flex-shrink-0" />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
            {teams.length > 0 ? (
              teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => {
                    onSelect(team);
                    setOpen(false);
                  }}
                  className="w-full text-left px-2 py-1 hover:bg-blue-50 text-xs flex items-center gap-2 border-b border-slate-100 last:border-b-0"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {team.logo}
                  </div>
                  <span className="truncate">{team.name}</span>
                </button>
              ))
            ) : (
              <div className="px-2 py-1 text-xs text-slate-500">All teams selected</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const MatchConnector = ({ side, level, matchIdx }) => {
    if (!bracket) return null;

    // Handle finals case
    if (side === 'finals') {
      if (!bracket.finals || !bracket.finals[0]) return null;
      const match = bracket.finals[0];
      const key = 'finals-0';
      const winnerId = matchResults[key];

      const handleSelectWinner = () => {
        if (match.team1 && match.team2) {
          setSelectedMatch({ side: 'finals', level: 'finals', matchIdx: 0 });
        }
      };

      return (
        <div className="flex flex-col items-center justify-center h-full px-2">
          {match.team1 && match.team2 ? (
            <button
              onClick={handleSelectWinner}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all flex-shrink-0
                hover:scale-110 active:scale-95
                ${!winnerId ? 'bg-amber-400 hover:bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}
                ${winnerId ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {!winnerId ? <Zap size={16} /> : '✓'}
            </button>
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs flex-shrink-0">
              —
            </div>
          )}
        </div>
      );
    }

    // Handle normal sides
    if (!bracket[side] || !bracket[side][level]) return null;
    
    const match = bracket[side][level][matchIdx];
    const key = `${side}-${level}-${matchIdx}`;
    const winnerId = matchResults[key];

    const handleSelectWinner = () => {
      if (match.team1 && match.team2) {
        setSelectedMatch({ side, level, matchIdx });
      }
    };

    return (
      <div className="flex flex-col items-center justify-center h-full px-2">
        {match.team1 && match.team2 ? (
          <button
            onClick={handleSelectWinner}
            className={`
              w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all flex-shrink-0
              hover:scale-110 active:scale-95
              ${!winnerId ? 'bg-amber-400 hover:bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}
              ${winnerId ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {!winnerId ? <Zap size={16} /> : '✓'}
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs flex-shrink-0">
            —
          </div>
        )}
      </div>
    );
  };

  const Level = ({ side, levelKey, title }) => {
    if (!bracket || !bracket[side][levelKey]) return null;

    const matches = bracket[side][levelKey];

    return (
      <div className="flex flex-col items-center gap-3">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
          {title}
        </h3>
        <div className="flex flex-col gap-4 justify-center">
          {matches.map((_, matchIdx) => (
            <div key={matchIdx} className="flex items-center gap-2">
              <div className="w-40 flex flex-col gap-1">
                <MatchSlot side={side} level={levelKey} matchIdx={matchIdx} position="team1" />
                <MatchSlot side={side} level={levelKey} matchIdx={matchIdx} position="team2" />
              </div>
              <MatchConnector side={side} level={levelKey} matchIdx={matchIdx} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getLevelKeys = () => {
    if (!bracket) return [];
    return Object.keys(bracket.leftSide)
      .filter(k => k.startsWith('level'))
      .sort((a, b) => {
        return parseInt(a.replace('level', '')) - parseInt(b.replace('level', ''));
      });
  };

  const FinalMatch = () => {
    if (!bracket || !bracket.finals || !bracket.finals[0]) return null;

    const finalMatch = bracket.finals[0];
    const key = 'finals-0';
    const winnerId = matchResults[key];

    const handleSelectWinner = () => {
      if (finalMatch.team1 && finalMatch.team2) {
        setSelectedMatch({ side: 'finals', level: 'finals', matchIdx: 0 });
      }
    };

    return (
      <div className="flex flex-col items-center gap-3">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Final</h3>
        <div className="flex items-center gap-4">
          <div className="w-40 flex flex-col gap-1">
            <div
              className={`
                relative border-2 rounded-lg p-2 transition-all max-w-full
                ${!finalMatch.team1 ? 'border-slate-300 bg-slate-50' : ''}
                ${finalMatch.team1 && winnerId === finalMatch.team1.id ? 'border-emerald-500 bg-emerald-50' : ''}
                ${finalMatch.team1 && winnerId && winnerId !== finalMatch.team1.id ? 'border-red-500 bg-red-50' : ''}
                ${finalMatch.team1 && !winnerId ? 'border-blue-400 bg-blue-50' : ''}
              `}
            >
              {finalMatch.team1 ? (
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {finalMatch.team1.logo}
                  </div>
                  <span className={`font-semibold text-xs truncate ${winnerId === finalMatch.team1.id ? 'text-emerald-700' : winnerId ? 'text-red-700' : 'text-slate-700'}`}>
                    {finalMatch.team1.name}
                  </span>
                </div>
              ) : (
                <div className="text-slate-400 text-xs">TBD</div>
              )}
            </div>
            <div
              className={`
                relative border-2 rounded-lg p-2 transition-all min-w-[140px]
                ${!finalMatch.team2 ? 'border-slate-300 bg-slate-50' : ''}
                ${finalMatch.team2 && winnerId === finalMatch.team2.id ? 'border-emerald-500 bg-emerald-50' : ''}
                ${finalMatch.team2 && winnerId && winnerId !== finalMatch.team2.id ? 'border-red-500 bg-red-50' : ''}
                ${finalMatch.team2 && !winnerId ? 'border-blue-400 bg-blue-50' : ''}
              `}
            >
              {finalMatch.team2 ? (
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {finalMatch.team2.logo}
                  </div>
                  <span className={`font-semibold text-xs truncate ${winnerId === finalMatch.team2.id ? 'text-emerald-700' : winnerId ? 'text-red-700' : 'text-slate-700'}`}>
                    {finalMatch.team2.name}
                  </span>
                </div>
              ) : (
                <div className="text-slate-400 text-xs">TBD</div>
              )}
            </div>
          </div>
          <MatchConnector side="finals" level="finals" matchIdx={0} />
        </div>
      </div>
    );
  };

  const { winner, runnerUp, thirdPlaceContenders } = getRankings();
  const levelKeys = getLevelKeys();
  const tournamentComplete = winner && runnerUp && thirdPlaceContenders.length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy size={36} className="text-yellow-400" />
            <h1 className="text-4xl font-black text-white tracking-tight">
              TOURNAMENT<span className="text-yellow-400"> BRACKET</span>
            </h1>
            <Trophy size={36} className="text-yellow-400" />
          </div>
          <p className="text-slate-400 font-light text-sm">Ultimate competition platform</p>
        </div>

        {!started ? (
          /* Setup Screen */
          <div className="max-w-md mx-auto">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">Start Tournament</h2>

              <div className="mb-6">
                <label className="block text-slate-300 text-sm font-semibold mb-3">
                  Number of Teams (Power of 2)
                </label>
                <select
                  value={numTeams}
                  onChange={(e) => setNumTeams(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white font-semibold focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Select...</option>
                  <option value="2">2 Teams</option>
                  <option value="4">4 Teams</option>
                  <option value="8">8 Teams</option>
                  <option value="16">16 Teams</option>
                  <option value="32">32 Teams</option>
                </select>
              </div>

              <button
                onClick={initializeBracket}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-3 rounded-lg transition-all active:scale-95 shadow-lg"
              >
                Initialize Bracket
              </button>

              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-slate-300 text-xs leading-relaxed">
                  💡 Left bracket and Right bracket compete separately. Winners meet in the Finals!
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Reset Button */}
            <div className="text-center mb-8">
              <button
                onClick={() => setStarted(false)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                ← Reset
              </button>
            </div>

            {/* Bracket Container - Left and Right */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 overflow-x-auto">
              <div className="flex gap-12 justify-center min-w-max mx-auto">
                {/* LEFT SIDE */}
                <div className="flex gap-4">
                  {levelKeys.map((levelKey) => (
                    <Level
                      key={levelKey}
                      side="leftSide"
                      levelKey={levelKey}
                      title={`Level ${parseInt(levelKey.replace('level', '')) + 1}`}
                    />
                  ))}
                </div>

                {/* FINALS - MIDDLE */}
                <FinalMatch />

                {/* RIGHT SIDE */}
                <div className="flex gap-4 flex-row-reverse">
                  {levelKeys.map((levelKey) => (
                    <Level
                      key={levelKey}
                      side="rightSide"
                      levelKey={levelKey}
                      title={`Level ${parseInt(levelKey.replace('level', '')) + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Rankings */}
            {tournamentComplete && (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {/* Runner Up (2nd Place) */}
                <div className="bg-gradient-to-br from-slate-300 to-slate-500 rounded-2xl p-6 shadow-xl">
                  <div className="text-center">
                    <Trophy size={40} className="mx-auto mb-4 text-slate-700" />
                    <h3 className="text-slate-900 text-xl font-black mb-2">RUNNER-UP</h3>
                    <div className="bg-white/30 backdrop-blur rounded-lg p-4 mb-2">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-300 to-slate-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
                        {runnerUp?.logo}
                      </div>
                      <p className="text-slate-900 font-bold text-sm">{runnerUp?.name}</p>
                    </div>
                    <p className="text-slate-700 text-xs font-semibold">🥈 2nd Place</p>
                  </div>
                </div>

                {/* Winner (1st Place) */}
                <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl p-6 shadow-2xl transform md:scale-105 md:z-10">
                  <div className="text-center">
                    <Trophy size={48} className="mx-auto mb-4 text-white" />
                    <h3 className="text-white text-2xl font-black mb-2">CHAMPION</h3>
                    <div className="bg-white/20 backdrop-blur rounded-lg p-4 mb-2">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-2">
                        {winner?.logo}
                      </div>
                      <p className="text-white font-bold text-lg">{winner?.name}</p>
                    </div>
                    <p className="text-yellow-900 text-xs font-semibold">🥇 1st Place</p>
                  </div>
                </div>

                {/* 3rd Place */}
                {thirdPlaceContenders.length >= 2 && (
                  <ThirdPlaceCard
                    contenders={thirdPlaceContenders}
                    winner={thirdPlaceWinner}
                    setWinner={setThirdPlaceWinner}
                    showModal={showThirdPlaceModal}
                    setShowModal={setShowThirdPlaceModal}
                  />
                )}
              </div>
            )}

            {/* Winner Selection Modal */}
            {selectedMatch && selectedMatch.side === 'finals' ? (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4">
                  <h3 className="text-2xl font-black text-slate-900 mb-6">Select Finals Winner</h3>
                  <div className="space-y-3">
                    {[bracket.finals[0].team1, bracket.finals[0].team2].map((team) => (
                      <button
                        key={team.id}
                        onClick={() => {
                          setMatchResults(prev => ({ ...prev, 'finals-0': team.id }));
                          setSelectedMatch(null);
                        }}
                        className="w-full p-4 border-2 border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-3 text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                          {team.logo}
                        </div>
                        <span className="font-bold text-slate-900">{team.name}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedMatch(null)}
                    className="w-full mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : selectedMatch ? (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4">
                  <h3 className="text-2xl font-black text-slate-900 mb-6">Select Winner</h3>
                  <div className="space-y-3">
                    {[
                      bracket[selectedMatch.side][selectedMatch.level][selectedMatch.matchIdx].team1,
                      bracket[selectedMatch.side][selectedMatch.level][selectedMatch.matchIdx].team2,
                    ].map((team) => (
                      <button
                        key={team.id}
                        onClick={() =>
                          selectWinner(selectedMatch.side, selectedMatch.level, selectedMatch.matchIdx, team.id)
                        }
                        className="w-full p-4 border-2 border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-3 text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                          {team.logo}
                        </div>
                        <span className="font-bold text-slate-900">{team.name}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedMatch(null)}
                    className="w-full mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

const ThirdPlaceCard = ({ contenders, winner, setWinner, showModal, setShowModal }) => {
  return (
    <>
      <div className="bg-gradient-to-br from-orange-300 to-orange-600 rounded-2xl p-6 shadow-xl">
        <div className="text-center">
          <div className="text-3xl mb-4">🥉</div>
          <h3 className="text-slate-900 text-xl font-black mb-2">3RD PLACE</h3>
          {!winner ? (
            <>
              <p className="text-slate-900 text-xs font-semibold mb-4">
                {contenders[0]?.name} vs {contenders[1]?.name}
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="w-full px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 rounded-lg font-bold transition-colors text-sm"
              >
                Decide Winner
              </button>
            </>
          ) : (
            <div className="bg-white/30 backdrop-blur rounded-lg p-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-300 to-orange-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
                {winner.logo}
              </div>
              <p className="text-slate-900 font-bold text-sm">{winner.name}</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4">
            <h3 className="text-2xl font-black text-slate-900 mb-6">3rd Place Match</h3>
            <div className="space-y-3">
              {contenders.map((team) => (
                <button
                  key={team.id}
                  onClick={() => {
                    setWinner(team);
                    setShowModal(false);
                  }}
                  className="w-full p-4 border-2 border-slate-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                    {team.logo}
                  </div>
                  <span className="font-bold text-slate-900 text-sm">{team.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-semibold transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TournamentBracket;