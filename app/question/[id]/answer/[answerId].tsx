import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AnswerAlias() {
  const { answerId } = useLocalSearchParams();
  return <Redirect href={`/answer/${answerId}`} />;
}
