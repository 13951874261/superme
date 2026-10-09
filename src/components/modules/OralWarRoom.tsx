import React, { useState } from 'react';
import { MessagesSquare, Mic, Users } from 'lucide-react';
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
import FreeOralConversation from './freeOral/FreeOralConversation';
import SpeakingSceneBrief from './SpeakingSceneBrief';

interface OralWarRoomProps {
  embedded?: boolean;
  active?: boolean;
  sceneTheme?: string;
  sessionId?: string | null;
  userId?: string;
  onOralRoundLogged?: () => void;
  onNavigateWrite?: () => void;
}

function RolePractice(props: OralWarRoomProps) {
  const session = useOralWarRoomSession(props);

  const content = (
    <div className="bg-[var(--color-canvas)] rounded-[2rem] xl:rounded-[2.5rem] p-3 sm:p-4 md:p-6 border border-[var(--color-border)] shadow-[var(--shadow-sm)] relative">
      <div className="grain-overlay" aria-hidden="true" />
      {session.showConfetti && <Confetti onComplete={() => session.setShowConfetti(false)} />}

      {!session.embedded && <OralWarRoomTacticalSop />}

      {session.speakingScene ? (
        <div className="mb-4">
          <SpeakingSceneBrief
            scene={session.speakingScene}
            onSwitch={session.handleSpeakingSceneSwitch}
            onRegenerate={session.handleSpeakingSceneRegenerate}
            switching={session.isSceneChanging && session.sceneChangeStatus.includes('换题')}
            regenerating={session.isSceneChanging && session.sceneChangeStatus.includes('重新生成')}
            status={session.sceneChangeStatus}
            error={session.sceneChangeError}
          />
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-800">
              {session.availableSpeakingScene ? `今日个性化场景：${session.availableSpeakingScene.content.title}` : '今日个性化场景尚未生成'}
            </p>
            <button
              type="button"
              onClick={session.availableSpeakingScene ? session.handleActivateAvailableSpeakingScene : session.handleSpeakingSceneRegenerate}
              disabled={session.isSceneChanging}
              className="shrink-0 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--color-brand-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {session.isSceneChanging ? '生成中…' : session.availableSpeakingScene ? '进入今日个性化场景' : '生成今日个性化场景'}
            </button>
          </div>
          {session.sceneChangeError ? <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{session.sceneChangeError}</p> : null}
        </div>
      )}

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

      <div
        key={session.sceneTransitionKey}
        className="grid h-auto grid-cols-1 gap-3 animate-fade-in xl:grid-cols-12 xl:gap-4"
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
            <div className="min-h-[520px] xl:col-span-3 xl:h-[min(820px,calc(100dvh-7rem))]">
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
            collectingZone={session.getCollectingZone(session.highlightedWord)}
            queuedZone={session.getQueuedZone(session.highlightedWord)}
            storedCategory={session.getStoredCategory(session.highlightedWord)}
            addResult={session.addWordResult}
            onCollect={(category) => { void session.handleAddHighlightedWord(category); }}
            onBlockedWhileCollecting={session.notifyBlocked}
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

  return content;
}

export default function OralWarRoom(props: OralWarRoomProps) {
  const [practiceMode, setPracticeMode] = useState<'role' | 'free'>('role');
  const tabs = (
    <div className="mb-3 flex w-full rounded-2xl border border-gray-200 bg-gray-100 p-1" role="tablist" aria-label="口语练习模式">
      <button
        type="button"
        role="tab"
        aria-selected={practiceMode === 'role'}
        onClick={() => setPracticeMode('role')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${practiceMode === 'role' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
      >
        <Users className="h-4 w-4" />角色练习
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={practiceMode === 'free'}
        onClick={() => setPracticeMode('free')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${practiceMode === 'free' ? 'bg-white text-[var(--color-brand)] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
      >
        <MessagesSquare className="h-4 w-4" />自由即兴对话
      </button>
    </div>
  );
  const content = (
    <>
      {tabs}
      <div hidden={practiceMode !== 'role'} role="tabpanel" aria-label="角色练习">
        <RolePractice {...props} embedded active={props.active !== false && practiceMode === 'role'} />
      </div>
      <div hidden={practiceMode !== 'free'} role="tabpanel" aria-label="自由即兴对话">
        <FreeOralConversation userId={props.userId || 'default-user'} active={props.active !== false && practiceMode === 'free'} />
      </div>
    </>
  );

  if (props.embedded) return content;
  return (
    <ModuleWrapper
      title="表达 ｜ 口语练习室"
      icon={<Mic className="w-8 h-8" strokeWidth={2.5} />}
      description="既可进入多角色场景训练，也可通过 Dify 连续上下文进行无预设主题的自由对话。"
    >
      {content}
    </ModuleWrapper>
  );
}