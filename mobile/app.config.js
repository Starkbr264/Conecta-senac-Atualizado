// app.config.js
// Configuracao dinamica do Expo. Preserva app.json e incorpora a identidade
// do perfil de build em extra.buildProfile, que fica disponivel em runtime via
// Constants.expoConfig.extra.buildProfile.
//
// Fontes (em ordem de prioridade):
//   1. APP_BUILD_PROFILE - variavel nao-publica definida por perfil no eas.json,
//      disponivel durante a avaliacao deste arquivo (local e servidor EAS).
//   2. EAS_BUILD_PROFILE - disponivel no servidor EAS durante a avaliacao.
//   3. EXPO_PUBLIC_APP_ENV - verificacao de coerencia (publica, no bundle).
//   4. 'development' - fallback para execucao local (Expo Go).
//
// Se APP_BUILD_PROFILE e EAS_BUILD_PROFILE estiverem ambos presentes e
// divergirem, a avaliacao falha (inconsistencia de build).
const appJson = require('./app.json');

const appBuildProfile = (process.env.APP_BUILD_PROFILE || '').toString().trim().toLowerCase();
const easBuildProfile = (process.env.EAS_BUILD_PROFILE || '').toString().trim().toLowerCase();
const expoPublicAppEnv = (process.env.EXPO_PUBLIC_APP_ENV || '').toString().trim().toLowerCase();

if (appBuildProfile && easBuildProfile && appBuildProfile !== easBuildProfile) {
  throw new Error(
    'Inconsistencia de build: APP_BUILD_PROFILE=' + appBuildProfile +
    ' != EAS_BUILD_PROFILE=' + easBuildProfile,
  );
}

const buildProfile = appBuildProfile || easBuildProfile || expoPublicAppEnv || 'development';

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo && appJson.expo.extra ? appJson.expo.extra : {}),
      buildProfile,
      appEnv: buildProfile,
    },
  },
};