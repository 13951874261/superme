import React from 'react';
import { Mic } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ModuleWrapper from './ModuleWrapper';
import Confetti from '../Confetti';
import OralWarRoomSceneSelector from './OralWarRoomSceneSelector';
import OralWarRoomContextPanel from './OralWarRoomContextPanel';
import OralWarRoomVocabPopup from './OralWarRoomVocabPopup';
import OralWarRoomBreakthroughMenu from './OralWarRoomBreakthroughMenu';
import OralWarRoomChat from './OralWarRoomChat';
import OralWarRoomSituationPanel from './OralWarRoomSituationPanel';
import OralWarRoomTacticalSop from './OralWarRoomTacticalSop';
import { SCENE_DATABASE } from './oralWarRoom/scenes';
import { getScenePartyCount } from './oralWarRoom/utils';
import { useOralWarRoomSession } from './oralWarRoom/useOralWarRoomSession';

interface OralWarRoomProps {
  embedded?: boolean;
  active?: boolean;
  sceneTheme?: string;
  sessionId?: string | null;
  userId?: string;
  onOralRoundLogged?: () => void;
  onNavigateWrite?: () => void;
}

export default function OralWarRoom(props: OralWarRoomProps) {
  const session = useOralWarRoomSession(props);

  const content = (
    <div className="bg-[var(--color-canvas)] rounded-[2rem] xl:rounded-[2.5rem] p-3 sm:p-4 md:p-6 border border-[var(--color-border)] shadow-[var(--shadow-sm)] relative">
      <div className="grain-overlay" aria-hidden="true" />
      {session.showConfetti && <Confetti onComplete={() => session.setShowConfetti(false)} />}

      {!session.embedded && <OralWarRoomTacticalSop />}

      {!session.embedded && (
        <OralWarRoomSceneSelector
          scenes={SCENE_DATABASE}
          selectedSceneId={session.activeSceneId}
          onSelect={session.handleSceneSelect}
          activeTierFilter={session.activeTierFilter}
          onTierFilterChange={session.setActiveTierFilter}
          activeLevelFilter={session.activeLevelFilter}
          onLevelFilterChange={session.setActiveLevelFilter}
          activeRoleCountFilter={session.activeRoleCountFilter}
          onRoleCountFilterChange={session.setActiveRoleCountFilter}
          filteredScenes={session.filteredScenes}
          sceneDifficultyStats={session.sceneDifficultyStats}
          getPartyCount={getScenePartyCount}
          sandboxMode={session.sandboxMode}
          onSandboxModeChange={session.handleSandboxModeChange}
          customBackground={session.customBackground}
          onCustomBackgroundChange={session.setCustomBackground}
          customBackgroundEnabled={session.customBackgroundEnabled}
          onCustomBackgroundEnabledChange={session.setCustomBackgroundEnabled}
        />
      )}

      <div
        key={session.sceneTransitionKey}
        className={`grid grid-cols-1 gap-4 xl:gap-6 h-auto animate-fade-in ${
          session.isContextPanelOpen ? '2xl:grid-cols-12' : '2xl:grid-cols-12'
        }`}
      >
        <OralWarRoomSituationPanel
          isContextPanelOpen={session.isContextPanelOpen}
          activeScene={session.activeScene}
          currentDifficulty={session.currentDifficulty}
          latestExchange={session.latestExchange}
          latestFeedback={session.latestFeedback}
        />

        <OralWarRoomChat
          isContextPanelOpen={session.isContextPanelOpen}
          setIsContextPanelOpen={session.setIsContextPanelOpen}
          improvElapsed={session.improvElapsed}
          improvActive={session.improvActive}
          setImprovElapsed={session.setImprovElapsed}
          setImprovActive={session.setImprovActive}
          setShowConfetti={session.setShowConfetti}
          onNavigateWrite={session.handleNavigateWrite}
          isSending={session.isSending}
          messages={session.messages}
          briefCollapsed={session.briefCollapsed}
          setBriefCollapsed={session.setBriefCollapsed}
          showIntelDetails={session.showIntelDetails}
          setShowIntelDetails={session.setShowIntelDetails}
          showGoldGlow={session.showGoldGlow}
          combatPoints={session.combatPoints}
          writeCompleted={session.writeCompleted}
          activeScene={session.activeScene}
          currentDifficulty={session.currentDifficulty}
          latestExchange={session.latestExchange}
          handleDialogueMouseUp={session.handleDialogueMouseUp}
          weaknessLog={session.weaknessLog}
          bottomRef={session.bottomRef}
          latestFeedback={session.latestFeedback}
          feedbackExpanded={session.feedbackExpanded}
          setFeedbackExpanded={session.setFeedbackExpanded}
          setInputText={session.setInputText}
          lastNotice={session.lastNotice}
          isLoopholePlanted={session.isLoopholePlanted}
          currentFlawType={session.currentFlawType}
          currentFlawClaim={session.currentFlawClaim}
          flawTemplates={session.flawTemplates}
          showControlCard={session.showControlCard}
          setShowControlCard={session.setShowControlCard}
          setIsInputLocked={session.setIsInputLocked}
          sceneRoleSwitcherItems={session.sceneRoleSwitcherItems}
          currentTarget={session.currentTarget}
          handleTargetChange={session.handleTargetChange}
          isRecording={session.isRecording}
          recordingTime={session.recordingTime}
          inputText={session.inputText}
          handleSend={session.handleSend}
          isInputLocked={session.isInputLocked}
          speechSupported={session.speechSupported}
          speechChecked={session.speechChecked}
          micError={session.micError}
          startRecording={session.startRecording}
          stopRecordingAndSend={session.stopRecordingAndSend}
          showNegotiationControls={session.showNegotiationControls}
          showDailyExpressionDebrief={session.showDailyExpressionDebrief}
          onEndDailyExpressionReview={session.handleEndDailyExpressionReview}
          expressionReview={session.expressionReview}
          expressionReviewStatus={session.expressionReviewStatus}
          expressionReviewError={session.expressionReviewError}
          onRetryOpening={session.handleRetryOpening}
        />

        <AnimatePresence>
          {session.isContextPanelOpen && (
            <div className="2xl:col-span-3 min-h-[520px] 2xl:h-[min(860px,calc(100dvh-6rem))]">
              <OralWarRoomContextPanel
                scene={session.activeScene}
                breakthroughRecords={session.breakthroughRecords}
                sessionNotes={session.sessionNotes}
                onNotesChange={(notes) => {
                  session.setSessionNotes(notes);
                  localStorage.setItem(`superme_session_notes_${session.activeSceneId}`, notes);
                }}
                onClose={() => session.setIsContextPanelOpen(false)}
                activeTab={session.activeContextTab}
                onTabChange={session.setActiveContextTab}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {session.highlightPos && session.highlightedWord && (
          <OralWarRoomVocabPopup
            word={session.highlightedWord}
            context={session.latestExchange.aiDialogue}
            position={session.highlightPos}
            isAdding={session.isAddingWord}
            addResult={session.addWordResult}
            onAdd={() => { void session.handleAddHighlightedWord(); }}
            onClose={session.dismissVocabPopup}
            difficulty="medium"
          />
        )}
      </AnimatePresence>

      {session.breakthroughMenu && (
        <OralWarRoomBreakthroughMenu
          position={session.breakthroughMenu.position}
          selectedText={session.breakthroughMenu.selectedText}
          onBreakthrough={(type) => {
            void session.handleBreakthroughSubmit(
              type,
              session.breakthroughMenu!.selectedText,
              session.breakthroughMenu!.messageId,
            );
          }}
          onClose={() => session.setBreakthroughMenu(null)}
        />
      )}
    </div>
  );

  if (session.embedded) return content;

  return (
    <ModuleWrapper
      title="表达 ｜ 多角色口语练习室"
      icon={<Mic className="w-8 h-8" strokeWidth={2.5} />}
      description="左侧常驻显示局势、角色与冲突点；右侧进行多角色对抗对话，并自动标出对话中的逻辑漏洞。"
    >
      {content}
    </ModuleWrapper>
  );
}
